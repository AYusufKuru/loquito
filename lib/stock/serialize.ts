import type { Material } from "@prisma/client";

import type { MaterialRow } from "./types";

type MaterialWithRelations = Material & {
  supplier?: { name: string } | null;
};

export function toMaterialRow(
  material: MaterialWithRelations,
  flavorName?: string | null,
  packagingLabel?: string | null,
): MaterialRow {
  const isLowStock =
    material.criticalLevel > 0 && material.currentQty <= material.criticalLevel;

  return {
    id: material.id,
    code: material.code,
    name: material.name,
    category: material.category as MaterialRow["category"],
    subcategory: material.subcategory,
    unit: material.unit,
    unitPriceCents: material.unitPriceCents,
    currentQty: material.currentQty,
    criticalLevel: material.criticalLevel,
    flavorId: material.flavorId,
    flavorName: flavorName ?? null,
    packagingId: material.packagingId,
    packagingLabel: packagingLabel ?? null,
    supplierId: material.supplierId,
    supplierName: material.supplier?.name ?? null,
    isDailySupply: material.isDailySupply,
    isActive: material.isActive,
    notes: material.notes,
    isLowStock,
  };
}
