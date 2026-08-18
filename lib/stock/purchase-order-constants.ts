export const PURCHASE_ORDER_STATUSES = [
  "pending",
  "ordered",
  "partial",
  "received",
  "cancelled",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: "Beklemede",
  ordered: "Sipariş verildi",
  partial: "Kısmen teslim",
  received: "Teslim alındı",
  cancelled: "İptal",
};

export const PURCHASE_ORDER_STATUS_TRANSITIONS: Record<
  PurchaseOrderStatus,
  PurchaseOrderStatus[]
> = {
  pending: ["ordered", "cancelled"],
  ordered: ["partial", "received", "cancelled"],
  partial: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

export function canTransitionPurchaseStatus(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return PURCHASE_ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
