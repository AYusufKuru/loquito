export interface FinishedStockRow {
  id: string;
  flavorId: string;
  flavorCode: string;
  flavorName: string;
  packagingId: string;
  packagingCode: string;
  packagingLabel: string;
  netWeightG: number;
  productId: string | null;
  productSku: string | null;
  lotNo: string | null;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  expiryDate: string | null;
  status: string;
  unitCostCents: number;
  valueCents: number;
  updatedAt: string;
}

export interface FinishedStockMatrixCell {
  flavorId: string;
  flavorCode: string;
  flavorName: string;
  packagingId: string;
  packagingCode: string;
  packagingLabel: string;
  netWeightG: number;
  quantity: number;
  reservedQty: number;
  availableQty: number;
}

export interface FinishedStockReservationRow {
  id: string;
  orderId: string;
  orderNo: string;
  orderItemId: string | null;
  stockId: string | null;
  flavorCode: string;
  flavorName: string;
  packagingLabel: string;
  quantity: number;
  status: string;
  lotNo: string | null;
  createdAt: string;
}

export interface FinishedStockSummary {
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  totalValueCents: number;
  lotCount: number;
  expiringSoonCount: number;
}
