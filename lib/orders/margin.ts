import type { PrismaClient } from "@prisma/client";

import {
  buildCostResult,
  boxesPerBatch,
  computePackagingCostCents,
  computeRawCostCents,
} from "@/lib/recipes/cost";

type Db = PrismaClient;

type ProductForCost = {
  packaging: {
    id: string;
    label: string;
    netWeightG: number;
    unitsPerBox: number;
  } | null;
  recipe: {
    yieldKg: number;
    items: Array<{
      id: string;
      itemType: string;
      materialId: string | null;
      packagingId: string | null;
      quantity: number;
      unit: string;
      notes: string | null;
      material: { unitPriceCents: number; subcategory: string | null } | null;
    }>;
  } | null;
};

/** Zaten yüklenmiş ürün + reçeteden kutu maliyetini hesaplar; ek sorgu yok. */
export function productUnitCostCents(product: ProductForCost): number {
  if (!product.recipe || !product.packaging) return 0;

  const recipe = product.recipe;
  const packaging = product.packaging;

  const rawItems = recipe.items
    .filter((i) => i.itemType === "raw")
    .map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialCode: null,
      materialName: null,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      subcategory: i.material?.subcategory ?? null,
    }));

  const prices = new Map<string, number>();
  for (const item of recipe.items) {
    if (item.materialId && item.material) {
      prices.set(item.materialId, item.material.unitPriceCents);
    }
  }

  const packagingItems = recipe.items
    .filter((i) => i.itemType === "packaging" && i.packagingId === packaging.id)
    .map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialCode: null,
      materialName: null,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      packagingId: packaging.id,
      subcategory: i.material?.subcategory ?? null,
      unitPriceCents: i.material?.unitPriceCents ?? 0,
      perBatch:
        i.notes === "per_batch" || i.material?.subcategory === "gelatin",
    }));

  const batchBoxes = boxesPerBatch(recipe.yieldKg, packaging.netWeightG);
  const rawCostCents = computeRawCostCents(rawItems, prices);
  const packagingCostCents = computePackagingCostCents(packagingItems, batchBoxes);

  const cost = buildCostResult(
    packaging.id,
    packaging.label,
    packaging.netWeightG,
    packaging.unitsPerBox,
    recipe.yieldKg,
    rawCostCents,
    packagingCostCents,
  );

  return cost.perBoxCents;
}

const costInclude = {
  packaging: true,
  recipe: {
    include: {
      items: {
        include: {
          material: {
            select: {
              unitPriceCents: true,
              subcategory: true,
            },
          },
        },
      },
    },
  },
} as const;

export async function getProductUnitCostCents(db: Db, productId: string): Promise<number> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: costInclude,
  });
  if (!product) return 0;
  return productUnitCostCents(product);
}

/** Benzersiz ürün kimlikleri için birim maliyeti tek sorguda döner. */
export async function getProductUnitCostCentsMap(
  db: Db,
  productIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(productIds)];
  const result = new Map<string, number>();
  if (unique.length === 0) return result;

  const products = await db.product.findMany({
    where: { id: { in: unique } },
    include: costInclude,
  });
  for (const product of products) {
    result.set(product.id, productUnitCostCents(product));
  }
  return result;
}
