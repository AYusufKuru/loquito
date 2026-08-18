import type { QuantityUnit } from "@/lib/pricing/types";

export function computeLineTotalCents(
  quantityBoxes: number,
  boxPriceCents: number,
  discountPercent: number,
): number {
  const gross = Math.round(quantityBoxes * boxPriceCents);
  if (!discountPercent || discountPercent <= 0) return gross;
  return Math.round(gross * (1 - discountPercent / 100));
}

export function boxesToUnits(quantityBoxes: number, unitsPerBox: number): number {
  return Math.round(quantityBoxes * unitsPerBox);
}

export function unitsToBoxes(quantityUnits: number, unitsPerBox: number): number {
  if (unitsPerBox <= 0) return 0;
  return quantityUnits / unitsPerBox;
}

export function syncLineQuantities(
  inputMode: "box" | "unit",
  quantityBoxes: number,
  quantityUnits: number,
  unitsPerBox: number,
): { quantityBoxes: number; quantityUnits: number } {
  if (unitsPerBox <= 0) {
    return { quantityBoxes, quantityUnits };
  }
  if (inputMode === "box") {
    return {
      quantityBoxes,
      quantityUnits: boxesToUnits(quantityBoxes, unitsPerBox),
    };
  }
  return {
    quantityUnits,
    quantityBoxes: unitsToBoxes(quantityUnits, unitsPerBox),
  };
}

export function quantityUnitForChannel(channel: string | null): QuantityUnit {
  if (channel === "proposal" || channel === "portal") return "unit";
  return "box";
}

export function computeOrderTotals(
  items: Array<{ totalCents: number }>,
  discountCents: number,
  freightCents: number,
): { subtotalCents: number; totalCents: number } {
  const subtotalCents = items.reduce((sum, i) => sum + i.totalCents, 0);
  const totalCents = Math.max(0, subtotalCents - discountCents + freightCents);
  return { subtotalCents, totalCents };
}

export function marginPercent(
  unitPriceCents: number,
  costUnitCents: number | null,
): number | null {
  if (!costUnitCents || unitPriceCents <= 0) return null;
  return Math.round(((unitPriceCents - costUnitCents) / unitPriceCents) * 10000) / 100;
}

export function priceDeviationPercent(
  actualCents: number,
  listCents: number | null,
): number | null {
  if (!listCents || listCents <= 0) return null;
  return Math.round(((actualCents - listCents) / listCents) * 10000) / 100;
}
