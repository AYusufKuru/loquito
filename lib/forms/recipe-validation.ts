import {
  buildErrors,
  parseDecimal,
  required,
  type FieldErrors,
} from "./validation";

export interface RecipeLineDraft {
  materialId: string;
  quantity: string;
  unit: string;
}

export function validateRecipeForm(params: {
  code: string;
  name: string;
  yieldKg: string;
  lines: RecipeLineDraft[];
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["code", required(params.code, "Reçete kodu")],
    ["name", required(params.name, "Reçete adı")],
  ];

  const yieldVal = parseDecimal(params.yieldKg, "Verim (kg)", { required: true, min: 0.001 });
  if (yieldVal.error) entries.push(["yieldKg", yieldVal.error]);

  const activeLines = params.lines.filter((l) => {
    const n = Number(l.quantity);
    return l.materialId && l.quantity.trim() && Number.isFinite(n) && n > 0;
  });

  if (activeLines.length === 0) {
    entries.push(["lines", "En az bir hammadde satırı gerekli."]);
  }

  params.lines.forEach((line, index) => {
    const qtyTrimmed = line.quantity.trim();
    if (!qtyTrimmed && !line.materialId) return;

    if (!line.materialId) {
      entries.push([`line-${index}-material`, `Hammadde satırı ${index + 1}: Malzeme seçin.`]);
    }

    if (qtyTrimmed) {
      const qty = parseDecimal(line.quantity, `Hammadde satırı ${index + 1} miktarı`, {
        required: true,
        min: 0.001,
      });
      if (qty.error) entries.push([`line-${index}-qty`, qty.error]);
    } else if (line.materialId) {
      entries.push([`line-${index}-qty`, `Hammadde satırı ${index + 1}: Miktar girin.`]);
    }

    if (line.materialId && !line.unit.trim()) {
      entries.push([`line-${index}-unit`, `Hammadde satırı ${index + 1}: Birim gerekli.`]);
    }
  });

  return buildErrors(entries);
}

export function validateRecipeCopyForm(params: {
  code: string;
  name: string;
}): FieldErrors | null {
  return buildErrors([
    ["copyCode", required(params.code, "Yeni reçete kodu")],
    ["copyName", required(params.name, "Yeni reçete adı")],
  ]);
}

export function validatePackagingForm(params: {
  packagingId: string;
  packagingLabel: string;
  lines: RecipeLineDraft[];
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["packagingId", required(params.packagingId, params.packagingLabel)],
  ];

  params.lines.forEach((line, index) => {
    const qtyTrimmed = line.quantity.trim();
    if (!qtyTrimmed && !line.materialId) return;

    if (!line.materialId) {
      entries.push([`pkg-${index}-material`, `Ambalaj satırı ${index + 1}: Malzeme seçin.`]);
    }

    if (qtyTrimmed) {
      const qty = parseDecimal(line.quantity, `Ambalaj satırı ${index + 1} miktarı`, {
        required: true,
        min: 0.001,
      });
      if (qty.error) entries.push([`pkg-${index}-qty`, qty.error]);
    } else if (line.materialId) {
      entries.push([`pkg-${index}-qty`, `Ambalaj satırı ${index + 1}: Miktar girin.`]);
    }
  });

  return buildErrors(entries);
}
