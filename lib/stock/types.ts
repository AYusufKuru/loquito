import type { MaterialCategory } from "./constants";

export interface MaterialRow {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  subcategory: string | null;
  unit: string;
  unitPriceCents: number;
  currentQty: number;
  criticalLevel: number;
  flavorId: string | null;
  flavorName: string | null;
  packagingId: string | null;
  packagingLabel: string | null;
  supplierId: string | null;
  supplierName: string | null;
  isDailySupply: boolean;
  isActive: boolean;
  notes: string | null;
  isLowStock: boolean;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export interface FlavorOption {
  id: string;
  code: string;
  name: string;
}

export interface PackagingOption {
  id: string;
  code: string;
  label: string;
}

export interface StockCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LotRow {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string;
  internalLotNo: string;
  supplierLotNo: string | null;
  quantity: number;
  expiryDate: string | null;
  status: string;
  receivedAt: string;
  notes: string | null;
  isUsable: boolean;
}

export interface MovementRow {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string;
  lotId: string | null;
  internalLotNo: string | null;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

export interface StockSummary {
  totalValueCents: number;
  availableValueCents: number;
  materialCount: number;
  alertCount: number;
  quarantineLotCount: number;
  alerts: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
}

export type { PurchaseOrderItemRow, PurchaseOrderRow } from "./purchase-order-serialize";
