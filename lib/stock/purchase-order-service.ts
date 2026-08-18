import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  canTransitionPurchaseStatus,
  type PurchaseOrderStatus,
} from "./purchase-order-constants";
import { applyStockMovementInTx } from "./movement-service";

type Tx = Prisma.TransactionClient;

export interface PurchaseOrderLineInput {
  materialId: string;
  quantity: number;
  unitPriceCents: number;
  notes?: string | null;
}

export interface ReceiveLineInput {
  itemId: string;
  quantity: number;
  supplierLotNo?: string | null;
  expiryDate?: string | null;
}

const orderInclude = {
  supplier: { select: { id: true, name: true } },
  items: {
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.PurchaseOrderInclude;

async function generateOrderNo(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const last = await tx.purchaseOrder.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: "desc" },
  });
  let seq = 1;
  if (last?.orderNo) {
    const n = Number.parseInt(last.orderNo.slice(prefix.length), 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function computeTotalCents(lines: PurchaseOrderLineInput[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0,
  );
}

function deriveStatusFromItems(
  items: Array<{ quantity: number; receivedQty: number }>,
): PurchaseOrderStatus {
  const totalOrdered = items.reduce((s, i) => s + i.quantity, 0);
  const totalReceived = items.reduce((s, i) => s + i.receivedQty, 0);
  if (totalReceived <= 0) return "ordered";
  if (totalReceived >= totalOrdered) return "received";
  return "partial";
}

export async function listPurchaseOrders(status?: string | null) {
  return prisma.purchaseOrder.findMany({
    where: status ? { status } : undefined,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPurchaseOrder(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: orderInclude,
  });
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  deliveryDate?: string | null;
  notes?: string | null;
  lines: PurchaseOrderLineInput[];
}) {
  if (input.lines.length === 0) {
    throw new Error("En az bir sipariş satırı gerekli.");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: input.supplierId },
  });
  if (!supplier) throw new Error("Tedarikçi bulunamadı.");

  const materialIds = [...new Set(input.lines.map((l) => l.materialId))];
  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, unit: true, isActive: true },
  });
  if (materials.length !== materialIds.length) {
    throw new Error("Geçersiz malzeme seçimi.");
  }
  const materialMap = new Map(materials.map((m) => [m.id, m]));

  return prisma.$transaction(async (tx) => {
    const orderNo = await generateOrderNo(tx);
    const totalCents = computeTotalCents(input.lines);

    const order = await tx.purchaseOrder.create({
      data: {
        orderNo,
        supplierId: input.supplierId,
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
        status: "pending",
        totalCents,
        notes: input.notes?.trim() || null,
        items: {
          create: input.lines.map((line) => {
            const mat = materialMap.get(line.materialId)!;
            return {
              materialId: line.materialId,
              quantity: line.quantity,
              unit: mat.unit,
              unitPriceCents: line.unitPriceCents,
              notes: line.notes?.trim() || null,
            };
          }),
        },
      },
      include: orderInclude,
    });

    return order;
  });
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus,
) {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) throw new Error("Satın alma siparişi bulunamadı.");

  const current = existing.status as PurchaseOrderStatus;
  if (!canTransitionPurchaseStatus(current, status)) {
    throw new Error("Bu durum geçişine izin verilmiyor.");
  }

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status },
    include: orderInclude,
  });
}

export async function receivePurchaseOrder(
  id: string,
  lines: ReceiveLineInput[],
) {
  if (lines.length === 0) {
    throw new Error("Teslim alınacak satır seçin.");
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new Error("Satın alma siparişi bulunamadı.");
  if (order.status === "cancelled" || order.status === "received") {
    throw new Error("Bu sipariş için teslim alma yapılamaz.");
  }

  const itemMap = new Map(order.items.map((i) => [i.id, i]));

  for (const line of lines) {
    const item = itemMap.get(line.itemId);
    if (!item) throw new Error("Geçersiz sipariş satırı.");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error("Teslim miktarı sıfırdan büyük olmalıdır.");
    }
    const remaining = item.quantity - item.receivedQty;
    if (line.quantity > remaining + 0.0001) {
      throw new Error(
        `${item.id}: teslim miktarı kalan miktardan fazla (${remaining}).`,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const item = itemMap.get(line.itemId)!;
      await applyStockMovementInTx(tx, {
        materialId: item.materialId,
        type: "in",
        quantity: line.quantity,
        createLot: true,
        supplierLotNo: line.supplierLotNo,
        expiryDate: line.expiryDate,
        notes: `Satın alma ${order.orderNo}`,
        referenceType: "purchase",
        referenceId: order.id,
      });

      await tx.purchaseOrderItem.update({
        where: { id: line.itemId },
        data: { receivedQty: { increment: line.quantity } },
      });
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
    });
    const nextStatus = deriveStatusFromItems(updatedItems);

    return tx.purchaseOrder.update({
      where: { id },
      data: { status: nextStatus },
      include: orderInclude,
    });
  });
}
