import type { Prisma } from "@prisma/client";

import type { TrackingEvent, TrackingStatus } from "@/lib/correios/types";

import { SHIPMENT_STATUS_LABELS } from "./constants";

export const shipmentInclude = {
  order: { select: { orderNo: true, status: true } },
  customer: { select: { name: true } },
  items: {
    include: {
      orderItem: {
        select: {
          quantityUnits: true,
          quantityBoxes: true,
          shippedUnits: true,
          shippedBoxes: true,
        },
      },
      product: {
        select: {
          sku: true,
          flavor: { select: { namePt: true } },
          packaging: { select: { label: true } },
        },
      },
      stock: { select: { lotNo: true } },
    },
  },
} satisfies Prisma.ShipmentInclude;

type ShipmentRow = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

export interface SerializedShipmentItem {
  id: string;
  orderItemId: string | null;
  productId: string | null;
  sku: string | null;
  flavorName: string | null;
  packagingLabel: string | null;
  lotNo: string | null;
  heldUnitCount: number;
  heldLotNo: string | null;
  stockId: string | null;
  boxCount: number;
  unitCount: number;
  shortageUnits: number;
  damageUnits: number;
  returnUnits: number;
}

export interface SerializedShipment {
  id: string;
  shipmentNo: string;
  orderId: string;
  orderNo: string;
  orderStatus: string;
  customerId: string;
  customerName: string;
  status: string;
  statusLabel: string;
  plannedShipDate: string | null;
  actualShipDate: string | null;
  plannedDelivery: string | null;
  actualDelivery: string | null;
  carrierName: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  trackingNo: string | null;
  trackingLastCheckedAt: string | null;
  trackingStatus: TrackingStatus | null;
  trackingStatusText: string | null;
  trackingExpectedAt: string | null;
  trackingService: string | null;
  trackingEvents: TrackingEvent[];
  trackingError: string | null;
  boxCount: number;
  palletCount: number;
  sealNo: string | null;
  receivedBy: string | null;
  proofNo: string | null;
  checkStockReserved: boolean;
  checkLotExpiry: boolean;
  checkLabels: boolean;
  checkQuantities: boolean;
  checkBoxCount: boolean;
  checkDocuments: boolean;
  checkDamage: boolean;
  issueShortageUnits: number;
  issueDamageUnits: number;
  issueReturnUnits: number;
  issueNotes: string | null;
  notes: string | null;
  createdAt: string;
  pendingDelete: boolean;
  items: SerializedShipmentItem[];
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function parseTrackingEvents(raw: Prisma.JsonValue | null | undefined): TrackingEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: TrackingEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    events.push({
      at: typeof row.at === "string" ? row.at : "",
      code: typeof row.code === "string" ? row.code : "",
      type: typeof row.type === "string" ? row.type : "",
      description: typeof row.description === "string" ? row.description : "",
      detail: typeof row.detail === "string" ? row.detail : null,
      city: typeof row.city === "string" ? row.city : null,
      uf: typeof row.uf === "string" ? row.uf : null,
      unitType: typeof row.unitType === "string" ? row.unitType : null,
    });
  }
  return events;
}

export function serializeShipment(
  row: ShipmentRow,
  extras?: { pendingDelete?: boolean },
): SerializedShipment {
  const status = row.status;
  return {
    id: row.id,
    shipmentNo: row.shipmentNo,
    orderId: row.orderId,
    orderNo: row.order.orderNo,
    orderStatus: row.order.status,
    customerId: row.customerId,
    customerName: row.customer.name,
    status,
    statusLabel: SHIPMENT_STATUS_LABELS[status as keyof typeof SHIPMENT_STATUS_LABELS] ?? status,
    plannedShipDate: iso(row.plannedShipDate)?.slice(0, 10) ?? null,
    actualShipDate: iso(row.actualShipDate)?.slice(0, 10) ?? null,
    plannedDelivery: iso(row.plannedDelivery)?.slice(0, 10) ?? null,
    actualDelivery: iso(row.actualDelivery)?.slice(0, 10) ?? null,
    carrierName: row.carrierName,
    driverName: row.driverName,
    vehiclePlate: row.vehiclePlate,
    trackingNo: row.trackingNo,
    trackingLastCheckedAt: iso(row.trackingLastCheckedAt),
    trackingStatus: (row.trackingStatus as TrackingStatus | null) ?? null,
    trackingStatusText: row.trackingStatusText,
    trackingExpectedAt: iso(row.trackingExpectedAt),
    trackingService: row.trackingService,
    trackingEvents: parseTrackingEvents(row.trackingEvents),
    trackingError: row.trackingError,
    boxCount: row.boxCount,
    palletCount: row.palletCount,
    sealNo: row.sealNo,
    receivedBy: row.receivedBy,
    proofNo: row.proofNo,
    checkStockReserved: row.checkStockReserved,
    checkLotExpiry: row.checkLotExpiry,
    checkLabels: row.checkLabels,
    checkQuantities: row.checkQuantities,
    checkBoxCount: row.checkBoxCount,
    checkDocuments: row.checkDocuments,
    checkDamage: row.checkDamage,
    issueShortageUnits: row.issueShortageUnits,
    issueDamageUnits: row.issueDamageUnits,
    issueReturnUnits: row.issueReturnUnits,
    issueNotes: row.issueNotes,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    pendingDelete: extras?.pendingDelete ?? false,
    items: row.items.map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      productId: item.productId,
      sku: item.product?.sku ?? null,
      flavorName: item.product?.flavor?.namePt ?? null,
      packagingLabel: item.product?.packaging?.label ?? null,
      lotNo: item.lotNo ?? item.stock?.lotNo ?? null,
      heldUnitCount: item.heldUnitCount,
      heldLotNo: item.heldLotNo,
      stockId: item.stockId,
      boxCount: item.boxCount,
      unitCount: item.unitCount,
      shortageUnits: item.shortageUnits,
      damageUnits: item.damageUnits,
      returnUnits: item.returnUnits,
    })),
  };
}
