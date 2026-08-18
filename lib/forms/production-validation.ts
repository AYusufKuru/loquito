import {
  buildErrors,
  parseDecimal,
  parseNonNegativeInt,
  parsePositiveInt,
  required,
  type FieldErrors,
} from "./validation";

export function validateProductionStart(lineId: string): FieldErrors | null {
  return buildErrors([["lineId", required(lineId, "Pişirici hattı")]]);
}

export function validateProductionComplete(params: {
  producedUnits: string;
  scrapKg: string;
  consumptions: Array<{
    id: string;
    materialCode: string;
    actualQty: string;
  }>;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  const units = parsePositiveInt(params.producedUnits, "Üretilen adet", { min: 1 });
  if (units.error) entries.push(["producedUnits", units.error]);

  if (params.scrapKg.trim()) {
    const scrap = parseDecimal(params.scrapKg, "Fire (kg)", { required: false, min: 0 });
    if (scrap.error) entries.push(["scrapKg", scrap.error]);
  }

  params.consumptions.forEach((c, index) => {
    const qty = parseDecimal(
      c.actualQty,
      `${c.materialCode || `Malzeme ${index + 1}`} gerçekleşen miktar`,
      { required: true, min: 0 },
    );
    if (qty.error) entries.push([`consumption-${c.id}`, qty.error]);
  });

  return buildErrors(entries);
}

export function validatePlanScenario(params: {
  boxes: string;
  startDate: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  const boxes = parsePositiveInt(params.boxes, "Senaryo koli sayısı", { min: 1 });
  if (boxes.error) entries.push(["scenarioBoxes", boxes.error]);

  if (!params.startDate.trim()) {
    entries.push(["startDate", "Plan başlangıç tarihi zorunludur."]);
  }

  return buildErrors(entries);
}

export function validateDowntimeReason(reason: string): FieldErrors | null {
  return buildErrors([["downtimeReason", required(reason, "Duruş nedeni")]]);
}

export function validateScrapEntry(scrapKg: string): FieldErrors | null {
  const scrap = parseDecimal(scrapKg, "Fire miktarı (kg)", { required: true, min: 0.001 });
  return buildErrors([["scrapKg", scrap.error]]);
}

export function validateQualityCheck(params: {
  parameter: string;
  actualValue: string;
}): FieldErrors | null {
  return buildErrors([
    ["qualityParam", required(params.parameter, "Kalite parametresi")],
    ["qualityActual", required(params.actualValue, "Ölçülen değer")],
  ]);
}

export function validateTrackKg(value: string): FieldErrors | null {
  const kg = parseDecimal(value, "Güncel kg", { required: true, min: 0 });
  return buildErrors([["currentKg", kg.error]]);
}

export function validateTrackProgress(value: string): FieldErrors | null {
  const progress = parseDecimal(value, "İlerleme yüzdesi", { required: true, min: 0 });
  if (progress.error) return buildErrors([["stageProgressPercent", progress.error]]);
  if (progress.value !== null && progress.value > 100) {
    return buildErrors([["stageProgressPercent", "İlerleme yüzdesi 100'den büyük olamaz."]]);
  }
  return null;
}

export function validateTrackUnits(value: string): FieldErrors | null {
  const units = parseNonNegativeInt(value, "Üretilen adet", true);
  return buildErrors([["producedUnits", units.error]]);
}
