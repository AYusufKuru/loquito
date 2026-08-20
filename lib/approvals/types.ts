export interface PendingApprovalRow {
  id: string;
  type: string;
  typeLabel: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  reason: string;
  requestedByName: string;
  requestedAt: string;
  orderNo: string | null;
  customerName: string | null;
}

export interface ShipmentDeletePayload {
  shipmentNo: string;
  orderNo: string;
  customerName: string;
}
