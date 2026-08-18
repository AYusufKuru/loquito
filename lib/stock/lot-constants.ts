export const LOT_STATUSES = [
  "quarantine",
  "released",
  "blocked",
  "destroyed",
  "rework",
] as const;

export type LotStatus = (typeof LOT_STATUSES)[number];

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  quarantine: "Karantina",
  released: "Serbest",
  blocked: "Bloke",
  destroyed: "İmha",
  rework: "Yeniden İşleme",
};

export const MOVEMENT_TYPES = ["in", "out", "scrap", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  in: "Giriş",
  out: "Çıkış",
  scrap: "Fire",
  adjustment: "Sayım / Düzeltme",
};

/** Serbest lotlar kullanılabilir stok sayılır */
export const USABLE_LOT_STATUSES: LotStatus[] = ["released"];

export function generateInternalLotNo(materialCode: string): string {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `L-${materialCode}-${suffix}`;
}
