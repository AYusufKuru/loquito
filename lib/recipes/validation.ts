export interface RawItemInput {
  materialId: string;
  quantity: number;
  unit: string;
  notes?: string | null;
}

export interface RecipeInput {
  code: string;
  name: string;
  flavorId: string | null;
  customerId: string | null;
  yieldKg: number;
  notes: string | null;
  rawItems: RawItemInput[];
}

export function parseRawItems(input: unknown): RawItemInput[] | null {
  if (!Array.isArray(input)) return null;
  const items: RawItemInput[] = [];

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

export function parseRecipeInput(body: unknown): { data?: RecipeInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Geçersiz veri." };

  const b = body as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";

  if (!code || !name) return { error: "Kod ve ad zorunludur." };

  const yieldKg =
    typeof b.yieldKg === "number" && b.yieldKg > 0 ? b.yieldKg : 70;

  const rawItems = parseRawItems(b.rawItems);
  if (!rawItems || rawItems.length === 0) {
    return { error: "En az bir hammadde satırı gerekli." };
  }

  return {
    data: {
      code,
      name,
      flavorId: typeof b.flavorId === "string" && b.flavorId ? b.flavorId : null,
      customerId:
        typeof b.customerId === "string" && b.customerId ? b.customerId : null,
      yieldKg,
      notes:
        typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
      rawItems,
    },
  };
}
