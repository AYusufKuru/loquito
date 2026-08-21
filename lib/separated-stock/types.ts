export interface SeparatedStockRow {
  id: string;
  flavorId: string;
  flavorName: string;
  packagingId: string;
  packagingLabel: string;
  productId: string | null;
  productSku: string | null;
  sourceStockId: string | null;
  lotNo: string | null;
  quantity: number;
  notes: string;
  createdAt: string;
}

export interface SeparatedLotOption {
  lotNo: string;
  quantity: number;
}
