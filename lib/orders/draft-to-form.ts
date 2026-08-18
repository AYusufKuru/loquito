import type { ParsedOrderDraft } from "@/lib/ocr/types";
import { DEFAULT_FREIGHT_TYPE, normalizeFreightType } from "@/lib/orders/constants";

export interface OrderFormDraftLine {
  productId: string;
  quantityBoxes: string;
  quantityUnits: string;
  unitPrice: string;
  boxPrice: string;
  discountPercent: string;
  totalCents: number;
  marginPercent: null;
  listUnitPriceCents: null;
  unitsPerBox: number;
}

export interface OrderFormDraft {
  customerId: string;
  channel: string;
  paymentTerms: string;
  freightType: string;
  deliveryDate: string;
  freightInput: string;
  notes: string;
  orderNo: string;
  lines: OrderFormDraftLine[];
  warnings: string[];
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function draftToOrderForm(draft: ParsedOrderDraft): OrderFormDraft {
  const warnings = [...draft.parseWarnings];

  const resolvedLines = draft.lines.filter((line) => line.productId && line.skuResolved);
  for (const line of draft.lines) {
    if (!line.skuResolved) {
      warnings.push(`SKU eşlenemedi: ${line.externalSku}`);
    }
  }

  const lines: OrderFormDraftLine[] =
    resolvedLines.length > 0
      ? resolvedLines.map((line) => ({
          productId: line.productId!,
          quantityBoxes: String(line.quantityBoxes || line.quantityInput || 0),
          quantityUnits: String(line.quantityUnits || 0),
          unitPrice: centsToInput(line.unitPriceCents),
          boxPrice: centsToInput(line.boxPriceCents),
          discountPercent: String(line.discountPercent || 0),
          totalCents: line.lineTotalCents,
          marginPercent: null,
          listUnitPriceCents: null,
          unitsPerBox: line.unitsPerBox ?? 0,
        }))
      : [];

  return {
    customerId: draft.customerId ?? "",
    channel: draft.channel,
    paymentTerms: draft.paymentTerms ?? "",
    freightType: normalizeFreightType(draft.freightType ?? DEFAULT_FREIGHT_TYPE),
    deliveryDate: draft.deliveryDate ? draft.deliveryDate.slice(0, 10) : "",
    freightInput: centsToInput(draft.freightCents),
    notes: draft.notes ?? "",
    orderNo: draft.referenceNo ?? "",
    lines,
    warnings,
  };
}
