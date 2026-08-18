export const REQUEST_TYPES = [
  { value: "machine", label: "Makine" },
  { value: "equipment", label: "Ekipman" },
  { value: "consumable", label: "Sarf malzemesi" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Düşük" },
  { value: "medium", label: "Orta" },
  { value: "high", label: "Yüksek" },
  { value: "critical", label: "Kritik" },
] as const;

export const PURCHASE_STATUSES = [
  "pending_approval",
  "approved",
  "ordered",
  "delivered",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending_approval: "Onay bekliyor",
  approved: "Onaylandı",
  ordered: "Sipariş verildi",
  delivered: "Teslim edildi",
};

/** İzin verilen durum geçişleri */
export const STATUS_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus | null> = {
  pending_approval: "approved",
  approved: "ordered",
  ordered: "delivered",
  delivered: null,
};

export const ASSET_CATEGORIES = [
  { value: "ofis", label: "Ofis" },
  { value: "üretim", label: "Üretim" },
  { value: "depo", label: "Depo" },
  { value: "altyapı", label: "Altyapı" },
] as const;
