export type PriceSource =
  | "customer_price"
  | "price_tier"
  | "price_list"
  | "default_list"
  | "none";

export type QuantityUnit = "box" | "unit";

export interface ResolvedPrice {
  productId: string;
  customerId: string;
  boxPriceCents: number | null;
  unitPriceCents: number | null;
  source: PriceSource;
  sourceDetail: string | null;
  quantity: number;
  quantityUnit: QuantityUnit;
}

export interface SkuResolution {
  productId: string;
  internalSku: string;
  externalSku: string;
  productName: string;
  matchType: "customer_channel" | "channel" | "internal";
}

export interface SalesRepRow {
  id: string;
  name: string;
  company: string | null;
  region: string | null;
  address: string | null;
  cep: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  customerCount: number;
}

export interface PriceListRow {
  id: string;
  code: string;
  name: string;
  channel: string | null;
  region: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  itemCount: number;
  customerCount: number;
}

export interface PriceListItemRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  boxPriceCents: number;
  unitPriceCents: number;
}

export interface CustomerPriceRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  boxPriceCents: number | null;
  unitPriceCents: number | null;
  validFrom: string | null;
  validTo: string | null;
  notes: string | null;
}

export interface PriceTierRow {
  id: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  thresholdQty: number;
  thresholdUnit: QuantityUnit;
  discountPercent: number | null;
  boxPriceCents: number | null;
  unitPriceCents: number | null;
  notes: string | null;
}

export interface ChannelCodeRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  channel: string;
  externalSku: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  cnpj: string | null;
  region: string | null;
  salesRepId: string | null;
  salesRepName: string | null;
  priceListId: string | null;
  priceListName: string | null;
  paymentTerms: string | null;
  freightType: string | null;
  address: string | null;
  deliveryAddress: string | null;
  billingAddress: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  isActive: boolean;
  balanceCents: number;
  notes: string | null;
  customerPriceCount: number;
  tierCount: number;
  channelCodeCount: number;
}

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  unitsPerBox: number;
}

export interface OrdersCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
