import type { OrderChannel } from "@/lib/orders/constants";

export type QuantityMode = "box" | "unit";

export interface ParsedOrderLine {
  lineIndex: number;
  externalSku: string;
  flavorName: string | null;
  netWeightG: number | null;
  unitsPerBox: number | null;
  quantityInput: number;
  quantityMode: QuantityMode;
  quantityBoxes: number;
  quantityUnits: number;
  unitPriceCents: number;
  boxPriceCents: number;
  lineTotalCents: number;
  discountPercent: number;
  productId: string | null;
  internalSku: string | null;
  productName: string | null;
  skuMatchType: string | null;
  skuResolved: boolean;
  warnings: string[];
}

export interface ParsedOrderDraft {
  channel: OrderChannel;
  channelLabel: string;
  quantityMode: QuantityMode;
  referenceNo: string | null;
  customerName: string | null;
  customerCnpj: string | null;
  customerId: string | null;
  orderDate: string | null;
  deliveryDate: string | null;
  paymentTerms: string | null;
  freightType: string | null;
  notes: string | null;
  subtotalCents: number;
  totalCents: number;
  freightCents: number;
  lines: ParsedOrderLine[];
  parseWarnings: string[];
  rawTextPreview: string;
}

export interface OrderImportResult {
  importId: string;
  fileName: string;
  fileType: string;
  previewUrl: string;
  draft: ParsedOrderDraft;
}
