import type { PrismaClient } from "@prisma/client";

import { consumeFinishedStockForShipment } from "@/lib/finished-stock/service";

import {
  CHECKLIST_FIELDS,
  type ChecklistField,
  isChecklistComplete,
  type ShipmentStatus,
} from "./constants";
import { shipmentInclude } from "./serialize";
import type { OrderShippingProgress, ShipmentItemInput } from "./types";

type Db = PrismaClient;

const SHIPPABLE_ORDER_STATUSES = ["approved", "in_production", "ready_ship", "shipped"];

export async function nextShipmentNo(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SHP-${year}-`;
  const latest = await db.shipment.findFirst({
    where: { shipmentNo: { startsWith: prefix } },
    orderBy: { shipmentNo: "desc" },
    select: { shipmentNo: true },
  });
  const lastNum = latest ? parseInt(latest.shipmentNo.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

export async function getOrderShippingProgress(
  db: Db,
  orderId: string,
): Promise<OrderShippingProgress | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: {
            select: {
              sku: true,
              flavor: { select: { namePt: true } },
              packaging: { select: { label: true } },
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const lines = order.items.map((item) => {
    const remainingUnits = Math.max(0, item.quantityUnits - item.shippedUnits);
    const remainingBoxes = Math.max(0, item.quantityBoxes - item.shippedBoxes);
    return {
      orderItemId: item.id,
      productId: item.productId,
      sku: item.product.sku,
      flavorName: item.product.flavor?.namePt ?? "",
      packagingLabel: item.product.packaging?.label ?? "",
      orderedUnits: item.quantityUnits,
      orderedBoxes: item.quantityBoxes,
      shippedUnits: item.shippedUnits,
      shippedBoxes: item.shippedBoxes,
      remainingUnits,
      remainingBoxes,
    };
  });

  const totalOrderedUnits = lines.reduce((s, l) => s + l.orderedUnits, 0);
  const totalShippedUnits = lines.reduce((s, l) => s + l.shippedUnits, 0);
  const totalRemainingUnits = lines.reduce((s, l) => s + l.remainingUnits, 0);

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    customerName: order.customer.name,
    status: order.status,
    totalOrderedUnits,
    totalShippedUnits,
    totalRemainingUnits,
    isFullyShipped: totalRemainingUnits === 0 && totalOrderedUnits > 0,
    lines,
  };
}

function validateShipmentItems(
  progress: OrderShippingProgress,
  items: ShipmentItemInput[],
): void {
  if (items.length === 0) {
    throw new Error("En az bir sevk kalemi gerekli.");
  }

  for (const item of items) {
    if (item.unitCount <= 0) {
      throw new Error("Sevk adedi sıfırdan büyük olmalı.");
    }
    const line = progress.lines.find((l) => l.orderItemId === item.orderItemId);
    if (!line) {
      throw new Error("Sipariş kalemi bulunamadı.");
    }
    if (item.unitCount > line.remainingUnits) {
      throw new Error(
        `${line.sku}: sevk adedi (${item.unitCount}) kalan miktarı (${line.remainingUnits}) aşıyor.`,
      );
    }
  }
}

export async function createShipment(
  db: Db,
  data: {
    orderId: string;
    plannedShipDate?: string | null;
    plannedDelivery?: string | null;
    items: ShipmentItemInput[];
    notes?: string | null;
  },
) {
  const order = await db.order.findUnique({
    where: { id: data.orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Sipariş bulunamadı.");
  if (!SHIPPABLE_ORDER_STATUSES.includes(order.status)) {
    throw new Error("Bu sipariş durumunda sevkiyat oluşturulamaz.");
  }

  const progress = await getOrderShippingProgress(db, data.orderId);
  if (!progress) throw new Error("Sipariş bulunamadı.");
  validateShipmentItems(progress, data.items);

  const shipmentNo = await nextShipmentNo(db);
  const totalBoxes = data.items.reduce((s, i) => s + i.boxCount, 0);

  const shipment = await db.shipment.create({
    data: {
      shipmentNo,
      orderId: order.id,
      customerId: order.customerId,
      status: "planned",
      plannedShipDate: data.plannedShipDate ? new Date(data.plannedShipDate) : null,
      plannedDelivery: data.plannedDelivery ? new Date(data.plannedDelivery) : null,
      boxCount: totalBoxes,
      notes: data.notes ?? null,
      items: {
        create: data.items.map((item) => {
          const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
          return {
            orderItemId: item.orderItemId,
            productId: orderItem?.productId ?? null,
            lotNo: item.lotNo ?? null,
            boxCount: item.boxCount,
            unitCount: item.unitCount,
            shortageUnits: item.shortageUnits ?? 0,
            damageUnits: item.damageUnits ?? 0,
            returnUnits: item.returnUnits ?? 0,
          };
        }),
      },
    },
    include: shipmentInclude,
  });

  return shipment;
}

export async function updateShipment(
  db: Db,
  id: string,
  patch: {
    status?: ShipmentStatus;
    plannedShipDate?: string | null;
    plannedDelivery?: string | null;
    carrierName?: string | null;
    driverName?: string | null;
    vehiclePlate?: string | null;
    trackingNo?: string | null;
    palletCount?: number;
    sealNo?: string | null;
    receivedBy?: string | null;
    proofNo?: string | null;
    notes?: string | null;
    issueShortageUnits?: number;
    issueDamageUnits?: number;
    issueReturnUnits?: number;
    issueNotes?: string | null;
    checklist?: Partial<Record<ChecklistField, boolean>>;
  },
) {
  const existing = await db.shipment.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) throw new Error("Sevkiyat bulunamadı.");

  const data: Record<string, unknown> = {};

  if (patch.plannedShipDate !== undefined) {
    data.plannedShipDate = patch.plannedShipDate ? new Date(patch.plannedShipDate) : null;
  }
  if (patch.plannedDelivery !== undefined) {
    data.plannedDelivery = patch.plannedDelivery ? new Date(patch.plannedDelivery) : null;
  }
  if (patch.carrierName !== undefined) data.carrierName = patch.carrierName;
  if (patch.driverName !== undefined) data.driverName = patch.driverName;
  if (patch.vehiclePlate !== undefined) data.vehiclePlate = patch.vehiclePlate;
  if (patch.trackingNo !== undefined) data.trackingNo = patch.trackingNo;
  if (patch.palletCount !== undefined) data.palletCount = patch.palletCount;
  if (patch.sealNo !== undefined) data.sealNo = patch.sealNo;
  if (patch.receivedBy !== undefined) data.receivedBy = patch.receivedBy;
  if (patch.proofNo !== undefined) data.proofNo = patch.proofNo;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.issueShortageUnits !== undefined) data.issueShortageUnits = patch.issueShortageUnits;
  if (patch.issueDamageUnits !== undefined) data.issueDamageUnits = patch.issueDamageUnits;
  if (patch.issueReturnUnits !== undefined) data.issueReturnUnits = patch.issueReturnUnits;
  if (patch.issueNotes !== undefined) data.issueNotes = patch.issueNotes;

  if (patch.checklist) {
    for (const field of CHECKLIST_FIELDS) {
      if (patch.checklist[field] !== undefined) {
        data[field] = patch.checklist[field];
      }
    }
  }

  if (patch.status && patch.status !== existing.status) {
    data.status = patch.status;
    if (patch.status === "delivered" && !existing.actualDelivery) {
      data.actualDelivery = new Date();
    }
    if (patch.status === "issue") {
      data.status = "issue";
    }
  }

  return db.shipment.update({
    where: { id },
    data,
    include: shipmentInclude,
  });
}

export async function dispatchShipment(db: Db, id: string) {
  const shipment = await db.shipment.findUnique({
    where: { id },
    include: { items: { include: { orderItem: true } } },
  });
  if (!shipment) throw new Error("Sevkiyat bulunamadı.");

  if (shipment.status === "in_transit" || shipment.status === "delivered") {
    throw new Error("Bu sevkiyat zaten yola çıkmış veya teslim edilmiş.");
  }

  const checklist = {
    checkStockReserved: shipment.checkStockReserved,
    checkLotExpiry: shipment.checkLotExpiry,
    checkLabels: shipment.checkLabels,
    checkQuantities: shipment.checkQuantities,
    checkBoxCount: shipment.checkBoxCount,
    checkDocuments: shipment.checkDocuments,
    checkDamage: shipment.checkDamage,
  };

  if (!isChecklistComplete(checklist)) {
    throw new Error("Sevk öncesi kontrol listesi tamamlanmalı.");
  }

  if (!shipment.carrierName?.trim()) {
    throw new Error("Taşıyıcı firma bilgisi gerekli.");
  }

  for (const item of shipment.items) {
    const stockId = await consumeFinishedStockForShipment(
      db,
      shipment.orderId,
      item.orderItemId,
      item.unitCount,
      item.lotNo,
    );

    await db.shipmentItem.update({
      where: { id: item.id },
      data: { stockId },
    });

    if (item.orderItemId && item.orderItem) {
      const boxesPerUnit =
        item.orderItem.quantityUnits > 0
          ? item.orderItem.quantityBoxes / item.orderItem.quantityUnits
          : 0;
      const shippedBoxes = boxesPerUnit * item.unitCount;

      await db.orderItem.update({
        where: { id: item.orderItemId },
        data: {
          shippedUnits: { increment: item.unitCount },
          shippedBoxes: { increment: shippedBoxes },
        },
      });
    }
  }

  await db.shipment.update({
    where: { id },
    data: {
      status: "in_transit",
      actualShipDate: new Date(),
    },
  });

  const progress = await getOrderShippingProgress(db, shipment.orderId);
  if (progress?.isFullyShipped) {
    await db.order.update({
      where: { id: shipment.orderId },
      data: { status: "shipped" },
    });
  } else if (progress && progress.totalShippedUnits > 0) {
    await db.order.update({
      where: { id: shipment.orderId },
      data: { status: "ready_ship" },
    });
  }

  return db.shipment.findUnique({
    where: { id },
    include: shipmentInclude,
  });
}

export async function listShipments(db: Db, filters?: { orderId?: string; status?: string }) {
  return db.shipment.findMany({
    where: {
      orderId: filters?.orderId ?? undefined,
      status: filters?.status ?? undefined,
    },
    include: shipmentInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getShipment(db: Db, id: string) {
  return db.shipment.findUnique({
    where: { id },
    include: shipmentInclude,
  });
}

export async function listShippableOrders(db: Db) {
  return db.order.findMany({
    where: {
      status: { in: ["approved", "in_production", "ready_ship"] },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
