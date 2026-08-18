export const ORDER_CHANNELS = [
  { value: "retail_form", labelKey: "channelRetail" },
  { value: "proposal", labelKey: "channelCorporate" },
  { value: "portal", labelKey: "channelPortal" },
] as const;

export type OrderChannel = (typeof ORDER_CHANNELS)[number]["value"];

export const ORDER_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "in_production",
  "ready_ship",
  "shipped",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const KANBAN_STATUSES: OrderStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "in_production",
  "ready_ship",
  "shipped",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Taslak",
  pending_approval: "Onay bekliyor",
  approved: "Onaylandı",
  in_production: "Üretimde",
  ready_ship: "Sevke hazır",
  shipped: "Sevk edildi",
  cancelled: "İptal",
};

/** Kanban'da izin verilen durum geçişleri */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "draft", "cancelled"],
  approved: ["in_production", "cancelled"],
  in_production: ["ready_ship", "cancelled"],
  ready_ship: ["shipped", "cancelled"],
  shipped: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Ciroya ve üretim yüküne sayılan durumlar: taslak henüz sipariş değil,
 * iptal edilenler de hesaba katılmaz. Maliyet dağıtımı ve raporlar bu listeyi
 * kullanır; durum adları `ORDER_STATUSES` ile birebir aynı olmalıdır.
 */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_approval",
  "approved",
  "in_production",
  "ready_ship",
  "shipped",
];

/** Henüz sevk edilmemiş, üretim planına giren siparişler. */
export const PIPELINE_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_approval",
  "approved",
  "in_production",
  "ready_ship",
];

/** Onay yetkisi gerektirmeyen durumlar — herkes bu durumlara taşıyabilir. */
export const UNAPPROVED_STATUSES: readonly string[] = [
  "draft",
  "pending_approval",
  "cancelled",
];

/**
 * `approved` ve sonrasındaki durumlar siparişi üretime açtığı için
 * yalnızca *sipariş onaylayabilir* yetkisi olan kullanıcıya izin verilir.
 */
export function requiresApprovalRight(status: string): boolean {
  return !UNAPPROVED_STATUSES.includes(status);
}

export const FREIGHT_TYPES = [
  { value: "Fabrikadan Teslim", legacy: "CIF" },
  { value: "Kara Yollarından Teslim", legacy: "FOB" },
] as const;

export type FreightType = (typeof FREIGHT_TYPES)[number]["value"];

export const DEFAULT_FREIGHT_TYPE: FreightType = "Fabrikadan Teslim";

/** Eski CIF/FOB değerlerini yeni etiketlere çevirir. */
export function normalizeFreightType(value: string | null | undefined): FreightType {
  if (!value) return DEFAULT_FREIGHT_TYPE;
  const match = FREIGHT_TYPES.find((t) => t.value === value || t.legacy === value);
  return match?.value ?? DEFAULT_FREIGHT_TYPE;
}
