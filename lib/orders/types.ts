export interface OrderItemInput {
  productId: string;
  quantityBoxes: number;
  quantityUnits: number;
  unitPriceCents: number;
  boxPriceCents: number;
  discountPercent: number;
  notes?: string | null;
}

export interface OrderItemRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unitsPerBox: number;
  quantityBoxes: number;
  quantityUnits: number;
  unitPriceCents: number;
  boxPriceCents: number;
  listUnitPriceCents: number | null;
  listBoxPriceCents: number | null;
  discountPercent: number;
  totalCents: number;
  costUnitCents: number | null;
  marginPercent: number | null;
  notes: string | null;
}

export interface OrderLineSummary {
  productSku: string;
  quantityBoxes: number;
  quantityUnits: number;
}

export interface OrderRow {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  status: string;
  channel: string | null;
  orderDate: string;
  deliveryDate: string | null;
  paymentTerms: string | null;
  freightType: string | null;
  totalCents: number;
  discountCents: number;
  freightCents: number;
  notes: string | null;
  approvedAt: string | null;
  itemCount: number;
  lineSummaries: OrderLineSummary[];
}

export interface OrderDetail extends OrderRow {
  items: OrderItemRow[];
  subtotalCents: number;
}

export interface OrderProductOption {
  id: string;
  sku: string;
  name: string;
  unitsPerBox: number;
  packagingCode: string | null;
  customerId: string | null;
}

export interface CatalogProductRow {
  id: string;
  sku: string;
  name: string;
  recipeId: string | null;
  recipeCode: string | null;
  recipeName: string | null;
  packagingId: string | null;
  packagingLabel: string | null;
  unitsPerBox: number;
  customerId: string | null;
}

export interface RecipePickOption {
  id: string;
  code: string;
  name: string;
}

export interface PackagingPickOption {
  id: string;
  code: string;
  label: string;
  netWeightG: number;
  unitsPerBox: number;
}

export interface OrdersCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSetPrice: boolean;
  canApproveOrder: boolean;
}
