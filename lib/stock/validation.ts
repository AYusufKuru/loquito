import type { MaterialCategory } from "./constants";
import { MATERIAL_CATEGORIES } from "./constants";

export interface MaterialInput {
  code: string;
  name: string;
  category: MaterialCategory;
  subcategory: string | null;
  unit: string;
  unitPriceCents: number;
  currentQty: number;
  criticalLevel: number;
  flavorId: string | null;
  packagingId: string | null;
  supplierId: string | null;
  isDailySupply: boolean;
  isActive: boolean;
  notes: string | null;
}

export function parseMaterialInput(body: unknown): { data?: MaterialInput; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Geçersiz veri." };
  }

  const b = body as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const category = typeof b.category === "string" ? b.category : "";
  const unit = typeof b.unit === "string" ? b.unit.trim() : "";

  if (!code || !name || !unit) {
    return { error: "Kod, ad ve birim zorunludur." };
  }

  if (!MATERIAL_CATEGORIES.includes(category as MaterialCategory)) {
    return { error: "Geçersiz kategori." };
  }

  const materialCategory = category as MaterialCategory;
  const subcategory =
    typeof b.subcategory === "string" && b.subcategory.trim()
      ? b.subcategory.trim()
      : null;

  const unitPriceCents =
    typeof b.unitPriceCents === "number" && b.unitPriceCents >= 0
      ? Math.round(b.unitPriceCents)
      : 0;

  const currentQty =
    typeof b.currentQty === "number" && Number.isFinite(b.currentQty) ? b.currentQty : 0;

  const criticalLevel =
    typeof b.criticalLevel === "number" && Number.isFinite(b.criticalLevel)
      ? b.criticalLevel
      : 0;

  const flavorId =
    typeof b.flavorId === "string" && b.flavorId ? b.flavorId : null;
  const packagingId =
    typeof b.packagingId === "string" && b.packagingId ? b.packagingId : null;
  const supplierId =
    typeof b.supplierId === "string" && b.supplierId ? b.supplierId : null;

  if (
    materialCategory === "packaging" &&
    subcategory === "box" &&
    (!flavorId || !packagingId)
  ) {
    return { error: "Kutu ambalajları için lezzet ve gramaj seçimi zorunludur." };
  }

  const notes =
    typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  return {
    data: {
      code,
      name,
      category: materialCategory,
      subcategory,
      unit,
      unitPriceCents,
      currentQty,
      criticalLevel,
      flavorId:
        materialCategory === "packaging" && subcategory === "box" ? flavorId : null,
      packagingId: materialCategory === "packaging" ? packagingId : null,
      supplierId,
      isDailySupply: Boolean(b.isDailySupply),
      isActive: typeof b.isActive === "boolean" ? b.isActive : true,
      notes,
    },
  };
}
