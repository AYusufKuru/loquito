import type { PackagingItemRow, RecipeItemRow } from "./types";

export function boxesPerBatch(yieldKg: number, netWeightG: number): number {
  if (netWeightG <= 0) return 0;
  return Math.floor((yieldKg * 1000) / netWeightG);
}

export function isPerBatchItem(
  subcategory: string | null,
  notes: string | null,
): boolean {
  if (notes === "per_batch") return true;
  return subcategory === "gelatin";
}

/** Su reçetede yer alır ama maliyete hammadde olarak yansımaz; genel giderdir. */
export const WATER_SUBCATEGORY = "water";

export function isOverheadMaterial(subcategory: string | null | undefined): boolean {
  return subcategory === WATER_SUBCATEGORY;
}

export function computeRawCostCents(items: RecipeItemRow[], prices: Map<string, number>): number {
  let total = 0;
  for (const item of items) {
    if (!item.materialId) continue;
    if (isOverheadMaterial(item.subcategory)) continue;
    const price = prices.get(item.materialId) ?? 0;
    total += item.quantity * price;
  }
  return Math.round(total);
}

export function computePackagingCostCents(
  items: PackagingItemRow[],
  boxesPerBatchCount: number,
): number {
  let total = 0;
  for (const item of items) {
    const multiplier = item.perBatch ? 1 : boxesPerBatchCount;
    total += item.quantity * item.unitPriceCents * multiplier;
  }
  return Math.round(total);
}

export interface RecipeCostResult {
  packagingId: string;
  packagingLabel: string;
  netWeightG: number;
  unitsPerBox: number;
  yieldKg: number;
  boxesPerBatch: number;
  rawCostCents: number;
  packagingCostCents: number;
  totalBatchCents: number;
  perKgCents: number;
  perBoxCents: number;
  perShipBoxCents: number;
}

export function buildCostResult(
  packagingId: string,
  packagingLabel: string,
  netWeightG: number,
  unitsPerBox: number,
  yieldKg: number,
  rawCostCents: number,
  packagingCostCents: number,
): RecipeCostResult {
  const batchBoxes = boxesPerBatch(yieldKg, netWeightG);
  const totalBatchCents = rawCostCents + packagingCostCents;
  const perKgCents = yieldKg > 0 ? Math.round(totalBatchCents / yieldKg) : 0;
  const perBoxCents =
    batchBoxes > 0 ? Math.round(totalBatchCents / batchBoxes) : 0;
  const perShipBoxCents = perBoxCents * (unitsPerBox > 0 ? unitsPerBox : 1);

  return {
    packagingId,
    packagingLabel,
    netWeightG,
    unitsPerBox,
    yieldKg,
    boxesPerBatch: batchBoxes,
    rawCostCents,
    packagingCostCents,
    totalBatchCents,
    perKgCents,
    perBoxCents,
    perShipBoxCents,
  };
}
