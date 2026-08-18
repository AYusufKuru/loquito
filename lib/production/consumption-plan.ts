import type { Prisma } from "@prisma/client";

import { boxesPerBatch, isPerBatchItem } from "@/lib/recipes/cost";

type RecipeWithItems = Prisma.RecipeGetPayload<{
  include: {
    items: {
      include: {
        material: { select: { id: true; code: true; name: true; unit: true; subcategory: true } };
      };
    };
  };
}>;

export interface PlannedConsumptionRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  plannedQty: number;
  itemType: string;
}

export function buildPlannedConsumptions(
  recipe: RecipeWithItems,
  packagingId: string,
  boxesPerBatchCount: number,
): PlannedConsumptionRow[] {
  const rows: PlannedConsumptionRow[] = [];

  for (const item of recipe.items.filter((i) => i.itemType === "raw")) {
    if (!item.materialId || !item.material) continue;
    rows.push({
      materialId: item.materialId,
      materialCode: item.material.code,
      materialName: item.material.name,
      unit: item.unit,
      plannedQty: item.quantity,
      itemType: "raw",
    });
  }

  for (const item of recipe.items.filter(
    (i) => i.itemType === "packaging" && i.packagingId === packagingId,
  )) {
    if (!item.materialId || !item.material) continue;
    const perBatch = isPerBatchItem(item.material.subcategory, item.notes);
    const multiplier = perBatch ? 1 : boxesPerBatchCount;
    rows.push({
      materialId: item.materialId,
      materialCode: item.material.code,
      materialName: item.material.name,
      unit: item.unit,
      plannedQty: item.quantity * multiplier,
      itemType: "packaging",
    });
  }

  return rows;
}

export function boxesPerBatchForRecipe(
  yieldKg: number,
  netWeightG: number,
): number {
  return boxesPerBatch(yieldKg, netWeightG);
}

export function generateProductionNo(sequence: number): string {
  const year = new Date().getFullYear();
  return `OP-${year}-${String(sequence).padStart(4, "0")}`;
}

export function generateProductionLotNo(productionNo: string, batchIndex: number): string {
  return `LOT-${productionNo.replace("OP-", "")}-B${batchIndex}`;
}
