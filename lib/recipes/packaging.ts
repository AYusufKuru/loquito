import type { RawMaterialOption } from "./types";

export interface PackagingLineInput {
  materialId: string;
  quantity: number;
  unit: string;
  notes?: string | null;
}

export function parsePackagingItems(input: unknown): PackagingLineInput[] | null {
  if (!Array.isArray(input)) return null;
  const items: PackagingLineInput[] = [];

  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const materialId = typeof r.materialId === "string" ? r.materialId : "";
    const quantity = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
    const unit = typeof r.unit === "string" ? r.unit.trim() : "";

    if (!materialId || !unit || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    items.push({
      materialId,
      quantity,
      unit,
      notes:
        typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
    });
  }

  return items;
}

/** Varsayılan ambalaj satırları — gramaj bazlı */
export function buildPackagingTemplate(
  flavorCode: string | null,
  packagingCode: string,
  unitsPerBox: number,
  materials: RawMaterialOption[],
): PackagingLineInput[] {
  const lines: PackagingLineInput[] = [];

  if (flavorCode) {
    const box = materials.find((m) => m.code === `KUTU_${flavorCode}_${packagingCode}`);
    if (box) {
      lines.push({ materialId: box.id, quantity: 1, unit: "adet" });
    }
  }

  const cradle = materials.find((m) => m.code === `BESIK_${packagingCode}`);
  if (cradle) {
    lines.push({ materialId: cradle.id, quantity: 1, unit: "adet" });
  }

  const ship = materials.find((m) => m.code === `KOLI_${packagingCode}`);
  if (ship && unitsPerBox > 0) {
    lines.push({
      materialId: ship.id,
      quantity: 1 / unitsPerBox,
      unit: "adet",
    });
  }

  const gelIn = materials.find((m) => m.code === "JELATIN_IC");
  const gelOut = materials.find((m) => m.code === "JELATIN_DIS");
  if (gelIn) {
    lines.push({ materialId: gelIn.id, quantity: 3.5, unit: "m", notes: "per_batch" });
  }
  if (gelOut) {
    lines.push({ materialId: gelOut.id, quantity: 3.5, unit: "m", notes: "per_batch" });
  }

  return lines;
}
