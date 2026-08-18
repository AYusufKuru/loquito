import type { RecipeItemRow } from "./types";

/** Hammadde girdisi (kg ve L birimleri) */
export function computeInputKg(items: RecipeItemRow[]): number {
  return items.reduce((sum, item) => {
    if (item.unit === "kg" || item.unit === "L") return sum + item.quantity;
    return sum;
  }, 0);
}

export function computeScrapPercent(inputKg: number, yieldKg: number): number {
  if (inputKg <= 0 || yieldKg <= 0) return 0;
  const scrap = ((inputKg - yieldKg) / inputKg) * 100;
  return Math.max(0, Math.round(scrap * 100) / 100);
}
