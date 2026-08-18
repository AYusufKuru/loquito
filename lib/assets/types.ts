export interface AssetRow {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  valueCents: number;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequestRow {
  id: string;
  requestType: string;
  itemName: string;
  description: string | null;
  usageArea: string | null;
  quantity: number;
  unit: string | null;
  priority: string | null;
  supplierId: string | null;
  supplierName: string | null;
  unitPriceCents: number;
  totalCents: number;
  deliveryDays: number | null;
  warranty: string | null;
  status: string;
  approvedBy: string | null;
  orderNo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseSummary {
  pendingApprovalCount: number;
  pendingApprovalTotalCents: number;
  approvedTotalCents: number;
  orderedTotalCents: number;
}
