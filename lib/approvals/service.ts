import type { Prisma, PrismaClient } from "@prisma/client";

import { recordAudit } from "@/lib/audit/service";
import { deleteShipment } from "@/lib/shipments/service";

import {
  PENDING_APPROVAL_TYPE_LABELS,
  type PendingApprovalType,
} from "./constants";
import type { PendingApprovalRow, ShipmentDeletePayload } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const MIN_REASON_LENGTH = 5;

function parsePayload(raw: string | null): Partial<ShipmentDeletePayload> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const row = parsed as Record<string, unknown>;
    return {
      shipmentNo: typeof row.shipmentNo === "string" ? row.shipmentNo : undefined,
      orderNo: typeof row.orderNo === "string" ? row.orderNo : undefined,
      customerName: typeof row.customerName === "string" ? row.customerName : undefined,
    };
  } catch {
    return {};
  }
}

export function serializePendingApproval(row: {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  reason: string;
  payload: string | null;
  requestedAt: Date;
  requestedBy: { name: string };
}): PendingApprovalRow {
  const payload = parsePayload(row.payload);
  const type = row.type as PendingApprovalType;
  return {
    id: row.id,
    type: row.type,
    typeLabel: PENDING_APPROVAL_TYPE_LABELS[type] ?? row.type,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel ?? payload.shipmentNo ?? row.entityId,
    reason: row.reason,
    requestedByName: row.requestedBy.name,
    requestedAt: row.requestedAt.toISOString(),
    orderNo: payload.orderNo ?? null,
    customerName: payload.customerName ?? null,
  };
}

export async function getPendingEntityIdSet(
  db: Db,
  type: PendingApprovalType,
): Promise<Set<string>> {
  const rows = await db.pendingApproval.findMany({
    where: { type, status: "pending" },
    select: { entityId: true },
  });
  return new Set(rows.map((row) => row.entityId));
}

export async function listPendingApprovals(db: Db): Promise<PendingApprovalRow[]> {
  const rows = await db.pendingApproval.findMany({
    where: { status: "pending" },
    include: { requestedBy: { select: { name: true } } },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });
  return rows.map(serializePendingApproval);
}

export async function requestShipmentDelete(
  db: PrismaClient,
  input: { shipmentId: string; reason: string; userId: string },
): Promise<PendingApprovalRow> {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON_LENGTH) {
    throw new Error(`Silme sebebi en az ${MIN_REASON_LENGTH} karakter olmalı.`);
  }

  const shipment = await db.shipment.findUnique({
    where: { id: input.shipmentId },
    include: {
      order: { select: { orderNo: true } },
      customer: { select: { name: true } },
    },
  });
  if (!shipment) throw new Error("Sevkiyat bulunamadı.");
  if (shipment.status !== "planned") {
    throw new Error("Yalnızca planlanan sevkiyatlar için silme talebi açılabilir.");
  }

  const existing = await db.pendingApproval.findFirst({
    where: {
      type: "shipment_delete",
      entityId: shipment.id,
      status: "pending",
    },
  });
  if (existing) {
    throw new Error("Bu sevkiyat için zaten onay bekleyen bir silme talebi var.");
  }

  const payload: ShipmentDeletePayload = {
    shipmentNo: shipment.shipmentNo,
    orderNo: shipment.order.orderNo,
    customerName: shipment.customer.name,
  };

  const created = await db.pendingApproval.create({
    data: {
      type: "shipment_delete",
      status: "pending",
      entityType: "shipment",
      entityId: shipment.id,
      entityLabel: shipment.shipmentNo,
      reason,
      payload: JSON.stringify(payload),
      requestedById: input.userId,
    },
    include: { requestedBy: { select: { name: true } } },
  });

  await recordAudit(db, {
    userId: input.userId,
    entityType: "shipment",
    entityId: shipment.id,
    action: "update",
    changes: [
      {
        field: "deleteRequest",
        oldValue: null,
        newValue: reason,
      },
    ],
  });

  return serializePendingApproval(created);
}

export async function approvePendingApproval(
  db: PrismaClient,
  input: { id: string; userId: string },
): Promise<void> {
  const pending = await db.pendingApproval.findUnique({
    where: { id: input.id },
  });
  if (!pending) throw new Error("Onay kaydı bulunamadı.");
  if (pending.status !== "pending") {
    throw new Error("Bu kayıt zaten işlenmiş.");
  }

  if (pending.type === "shipment_delete") {
    const shipment = await db.shipment.findUnique({
      where: { id: pending.entityId },
      select: { id: true },
    });
    if (shipment) {
      await deleteShipment(db, pending.entityId);
    }
  } else {
    throw new Error("Bilinmeyen onay türü.");
  }

  await db.pendingApproval.update({
    where: { id: pending.id },
    data: {
      status: "approved",
      reviewedById: input.userId,
      reviewedAt: new Date(),
    },
  });

  await recordAudit(db, {
    userId: input.userId,
    entityType: pending.entityType,
    entityId: pending.entityId,
    action: "delete",
    changes: [
      {
        field: "status",
        oldValue: "pending",
        newValue: "deleted",
      },
    ],
  });
}
