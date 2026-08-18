import type { OrderItemRow, OrderLineSummary, OrderRow } from "./types";
import { toIsoString } from "@/lib/utils/datetime";

type OrderItemForSummary = {
  quantityBoxes: number;
  quantityUnits: number;
  productSku?: string;
  product?: { sku: string };
};

function extractLineSummaries(items?: OrderItemForSummary[]): OrderLineSummary[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    productSku: item.productSku ?? item.product?.sku ?? "—",
    quantityBoxes: item.quantityBoxes,
    quantityUnits: item.quantityUnits,
  }));
}

export function toOrderRow(
  order: {
    id: string;
    orderNo: string;
    customerId: string;
    status: string;
    channel: string | null;
    orderDate: Date | string;
    deliveryDate: Date | string | null;
    paymentTerms: string | null;
    freightType: string | null;
    totalCents: number;
    discountCents: number;
    freightCents?: number;
    notes: string | null;
    approvedAt: Date | string | null;
    customer?: { name: string };
    items?: OrderItemForSummary[];
  },
): OrderRow {
  return {
    id: order.id,
    orderNo: order.orderNo,
    customerId: order.customerId,
    customerName: order.customer?.name ?? "",
    status: order.status,
    channel: order.channel,
    orderDate: toIsoString(order.orderDate) ?? "",
    deliveryDate: toIsoString(order.deliveryDate),
    paymentTerms: order.paymentTerms,
    freightType: order.freightType,
    totalCents: order.totalCents,
    discountCents: order.discountCents,
    freightCents: order.freightCents ?? 0,
    notes: order.notes,
    approvedAt: toIsoString(order.approvedAt),
    itemCount: order.items?.length ?? 0,
    lineSummaries: extractLineSummaries(order.items),
  };
}

export function lineSummariesFromItems(items: OrderItemRow[]): OrderLineSummary[] {
  return extractLineSummaries(items);
}

export function toOrderItemRow(
  item: {
    id: string;
    productId: string;
    quantityBoxes: number;
    quantityUnits: number;
    unitPriceCents: number;
    boxPriceCents: number;
    discountPercent: number;
    totalCents: number;
    notes: string | null;
    product: {
      sku: string;
      name: string;
      packaging?: { unitsPerBox: number } | null;
    };
  },
  extras?: {
    listUnitPriceCents?: number | null;
    listBoxPriceCents?: number | null;
    costUnitCents?: number | null;
    marginPercent?: number | null;
  },
): OrderItemRow {
  return {
    id: item.id,
    productId: item.productId,
    productSku: item.product.sku,
    productName: item.product.name,
    unitsPerBox: item.product.packaging?.unitsPerBox ?? 0,
    quantityBoxes: item.quantityBoxes,
    quantityUnits: item.quantityUnits,
    unitPriceCents: item.unitPriceCents,
    boxPriceCents: item.boxPriceCents,
    listUnitPriceCents: extras?.listUnitPriceCents ?? null,
    listBoxPriceCents: extras?.listBoxPriceCents ?? null,
    discountPercent: item.discountPercent,
    totalCents: item.totalCents,
    costUnitCents: extras?.costUnitCents ?? null,
    marginPercent: extras?.marginPercent ?? null,
    notes: item.notes,
  };
}
