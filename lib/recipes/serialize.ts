import type { Recipe, RecipeItem } from "@prisma/client";

import { isPerBatchItem } from "./cost";
import { computeInputKg, computeScrapPercent } from "./compute";
import type {
  PackagingItemRow,
  PackagingProfile,
  RecipeDetail,
  RecipeItemRow,
  RecipeRow,
} from "./types";

type MaterialInfo = {
  code: string;
  name: string;
  subcategory: string | null;
  unitPriceCents: number;
};

type RecipeItemWithMaterial = RecipeItem & {
  material?: MaterialInfo | null;
};

type RecipeWithRelations = Recipe & {
  flavor?: { namePt: string; code: string } | null;
  customer?: { name: string } | null;
  items?: RecipeItemWithMaterial[];
};

type PackagingMeta = {
  id: string;
  code: string;
  label: string;
  netWeightG: number;
  unitsPerBox: number;
  isActive?: boolean;
};

function toRawItemRow(item: RecipeItemWithMaterial): RecipeItemRow {
  return {
    id: item.id,
    materialId: item.materialId,
    materialCode: item.material?.code ?? null,
    materialName: item.material?.name ?? null,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes,
    subcategory: item.material?.subcategory ?? null,
  };
}

function toPackagingItemRow(
  item: RecipeItemWithMaterial,
  packagingId: string,
): PackagingItemRow {
  return {
    id: item.id,
    materialId: item.materialId,
    materialCode: item.material?.code ?? null,
    materialName: item.material?.name ?? null,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes,
    packagingId,
    subcategory: item.material?.subcategory ?? null,
    unitPriceCents: item.material?.unitPriceCents ?? 0,
    perBatch: isPerBatchItem(item.material?.subcategory ?? null, item.notes),
  };
}

function buildPackagingProfiles(
  items: RecipeItemWithMaterial[],
  packagings: PackagingMeta[],
): PackagingProfile[] {
  const activePackagings = packagings.filter((p) => p.isActive !== false);

  return activePackagings.map((pkg) => ({
    packagingId: pkg.id,
    packagingCode: pkg.code,
    packagingLabel: pkg.label,
    netWeightG: pkg.netWeightG,
    unitsPerBox: pkg.unitsPerBox,
    items: items
      .filter((i) => i.itemType === "packaging" && i.packagingId === pkg.id)
      .map((i) => toPackagingItemRow(i, pkg.id)),
  }));
}

export function toRecipeRow(
  recipe: RecipeWithRelations,
  rawItemCount?: number,
  packagingProfileCount?: number,
): RecipeRow {
  const rawItems = recipe.items?.filter((i) => i.itemType === "raw") ?? [];
  const packagingIds = new Set(
    recipe.items
      ?.filter((i) => i.itemType === "packaging" && i.packagingId)
      .map((i) => i.packagingId!) ?? [],
  );

  return {
    id: recipe.id,
    code: recipe.code,
    name: recipe.name,
    flavorId: recipe.flavorId,
    flavorName: recipe.flavor?.namePt ?? null,
    flavorCode: recipe.flavor?.code ?? null,
    customerId: recipe.customerId,
    customerName: recipe.customer?.name ?? null,
    yieldKg: recipe.yieldKg,
    scrapPercent: recipe.scrapPercent,
    version: recipe.version,
    isActive: recipe.isActive,
    notes: recipe.notes,
    rawItemCount: rawItemCount ?? rawItems.length,
    packagingProfileCount: packagingProfileCount ?? packagingIds.size,
    isCustomerSpecific: Boolean(recipe.customerId),
  };
}

export function toRecipeDetail(
  recipe: RecipeWithRelations,
  packagings: PackagingMeta[],
): RecipeDetail {
  const items = recipe.items ?? [];
  const rawItems = items.filter((i) => i.itemType === "raw").map(toRawItemRow);
  const inputKg = computeInputKg(rawItems);
  const packagingProfiles = buildPackagingProfiles(items, packagings);

  return {
    ...toRecipeRow(recipe, rawItems.length, packagingProfiles.filter((p) => p.items.length > 0).length),
    rawItems,
    inputKg,
    packagingProfiles,
  };
}

export function scrapFromItems(rawItems: RecipeItemRow[], yieldKg: number): number {
  return computeScrapPercent(computeInputKg(rawItems), yieldKg);
}
