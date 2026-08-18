export interface OrderShippingLine {
  orderItemId: string;
  productId: string;
  sku: string;
  flavorName: string;
  packagingLabel: string;
  orderedUnits: number;
  orderedBoxes: number;
  shippedUnits: number;
  shippedBoxes: number;
  remainingUnits: number;
  remainingBoxes: number;
}

export interface OrderShippingProgress {
  orderId: string;
  orderNo: string;
  customerName: string;
  status: string;
  totalOrderedUnits: number;
  totalShippedUnits: number;
  totalRemainingUnits: number;
  isFullyShipped: boolean;
  lines: OrderShippingLine[];
}

export interface ShipmentItemInput {
  orderItemId: string;
  boxCount: number;
  unitCount: number;
  lotNo?: string | null;
  shortageUnits?: number;
  damageUnits?: number;
  returnUnits?: number;
}
