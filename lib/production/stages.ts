export const PRODUCTION_STAGES = [
  "preparation",
  "cooking",
  "mixing",
  "cooling",
  "cutting",
  "arranging",
  "packaging",
  "quality_control",
  "finished_goods",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const STAGE_LABELS: Record<ProductionStage, string> = {
  preparation: "Hazırlık",
  cooking: "Pişirme",
  mixing: "Karıştırma",
  cooling: "Soğutma / Dinlendirme",
  cutting: "Kesim",
  arranging: "Dizim",
  packaging: "Kaplama / Paketleme",
  quality_control: "Kalite Kontrol",
  finished_goods: "Mamul Depo",
};

export const COOKER_STAGES: ProductionStage[] = [
  "preparation",
  "cooking",
  "mixing",
  "cooling",
];

export const CUTTING_STAGES: ProductionStage[] = ["cutting", "arranging"];
export const PACKAGING_STAGES: ProductionStage[] = ["packaging", "quality_control", "finished_goods"];

export const SHIFTS = ["morning", "afternoon", "night", "special"] as const;
export type Shift = (typeof SHIFTS)[number];

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: "Sabah",
  afternoon: "Akşam",
  night: "Gece",
  special: "Özel",
};

export const QUALITY_DECISIONS = ["pending", "approved", "conditional", "rejected"] as const;
export type QualityDecision = (typeof QUALITY_DECISIONS)[number];

export const QUALITY_DECISION_LABELS: Record<QualityDecision, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  conditional: "Şartlı Onay",
  rejected: "Reddedildi",
};

export const LINE_STATUS_LABELS: Record<string, string> = {
  idle: "Boşta",
  running: "Çalışıyor",
  maintenance: "Bakım",
  downtime: "Duruş",
};

export function nextStage(current: ProductionStage): ProductionStage | null {
  const idx = PRODUCTION_STAGES.indexOf(current);
  if (idx < 0 || idx >= PRODUCTION_STAGES.length - 1) return null;
  return PRODUCTION_STAGES[idx + 1];
}

export function stageLineType(stage: ProductionStage): "cooker" | "cutting" | "packaging" | null {
  if (COOKER_STAGES.includes(stage)) return "cooker";
  if (CUTTING_STAGES.includes(stage)) return "cutting";
  if (PACKAGING_STAGES.includes(stage)) return "packaging";
  return null;
}

export function isLastStage(stage: ProductionStage): boolean {
  return stage === PRODUCTION_STAGES[PRODUCTION_STAGES.length - 1];
}

export function stageNumber(stage: ProductionStage): number {
  const idx = PRODUCTION_STAGES.indexOf(stage);
  return idx >= 0 ? idx + 1 : 0;
}
