export const PENDING_APPROVAL_TYPES = ["shipment_delete"] as const;
export type PendingApprovalType = (typeof PENDING_APPROVAL_TYPES)[number];

export const PENDING_APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type PendingApprovalStatus = (typeof PENDING_APPROVAL_STATUSES)[number];

export const PENDING_APPROVAL_TYPE_LABELS: Record<PendingApprovalType, string> = {
  shipment_delete: "Sevkiyat silme",
};

export function isPendingApprovalType(value: string): value is PendingApprovalType {
  return (PENDING_APPROVAL_TYPES as readonly string[]).includes(value);
}
