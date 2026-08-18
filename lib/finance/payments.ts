import type { PrismaClient } from "@prisma/client";

import { recordAudit } from "@/lib/audit/service";
import { cachedQuery, REVALIDATE } from "@/lib/cache/server";

import {
  computeDueDate,
  computeExpectedAmount,
  computePaymentStatus,
  daysUntilDue,
  parsePaymentTerms,
  type PaymentStatusKey,
} from "./payment-terms";

type Db = PrismaClient;

export interface OrderPaymentRow {
  orderId: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  paymentTerms: string | null;
  orderTotalCents: number;
  expectedCents: number;
  paidCents: number;
  remainingCents: number;
  discountPercent: number;
  dueDate: string | null;
  status: PaymentStatusKey;
  daysUntilDue: number | null;
  paymentIds: string[];
}

export interface PaymentRow {
  id: string;
  orderId: string | null;
  orderNo: string | null;
  customerId: string | null;
  customerName: string | null;
  amountCents: number;
  direction: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
  isApproved: boolean;
  notes: string | null;
  createdAt: string;
}

export async function syncOrderPaymentExpectations(db: Db): Promise<void> {
  const orders = await db.order.findMany({
    where: { status: { notIn: ["draft", "cancelled"] } },
    include: { payments: { where: { direction: "in" } } },
  });

  for (const order of orders) {
    if (order.payments.length > 0) continue;

    const terms = parsePaymentTerms(order.paymentTerms);
    const expected = computeExpectedAmount(order.totalCents, terms.discountPercent);

    await db.payment.create({
      data: {
        orderId: order.id,
        customerId: order.customerId,
        amountCents: expected,
        direction: "in",
        status: "pending",
        dueDate: computeDueDate(order.orderDate, terms.days),
        method: terms.method,
        notes: terms.label,
      },
    });
  }
}

export async function listOrderPayments(
  db: Db,
  filters?: { overdueOnly?: boolean; customerId?: string },
): Promise<OrderPaymentRow[]> {
  const filterKey = filters?.customerId
    ? `customer:${filters.customerId}`
    : filters?.overdueOnly
      ? "overdue"
      : "all";

  return cachedQuery(
    ["order-payments", filterKey],
    () => listOrderPaymentsUncached(db, filters),
    REVALIDATE.dashboard,
    ["payments", "dashboard"],
  );
}

async function listOrderPaymentsUncached(
  db: Db,
  filters?: { overdueOnly?: boolean; customerId?: string },
): Promise<OrderPaymentRow[]> {
  await syncOrderPaymentExpectations(db);

  const orders = await db.order.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
    },
    include: {
      customer: { select: { name: true } },
      payments: { where: { direction: "in" } },
    },
    orderBy: { orderDate: "desc" },
    take: 200,
  });

  const rows: OrderPaymentRow[] = [];

  for (const order of orders) {
    const terms = parsePaymentTerms(order.paymentTerms);
    const expected = computeExpectedAmount(order.totalCents, terms.discountPercent);
    const paidCents = order.payments
      .filter((p) => p.paidAt != null || p.status === "paid")
      .reduce((s, p) => s + p.amountCents, 0);

    const primaryPayment = order.payments.find((p) => p.dueDate) ?? order.payments[0];
    const dueDate = primaryPayment?.dueDate ?? computeDueDate(order.orderDate, terms.days);
    const status = computePaymentStatus(expected, paidCents, dueDate);

    if (filters?.overdueOnly && status !== "overdue") continue;

    rows.push({
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      customerName: order.customer.name,
      orderDate: order.orderDate.toISOString(),
      paymentTerms: order.paymentTerms,
      orderTotalCents: order.totalCents,
      expectedCents: expected,
      paidCents,
      remainingCents: Math.max(0, expected - paidCents),
      discountPercent: terms.discountPercent,
      dueDate: dueDate?.toISOString() ?? null,
      status,
      daysUntilDue: daysUntilDue(dueDate),
      paymentIds: order.payments.map((p) => p.id),
    });
  }

  return rows;
}

export async function recordPayment(
  db: Db,
  data: {
    orderId?: string | null;
    customerId?: string | null;
    amountCents: number;
    direction?: string;
    method?: string | null;
    reference?: string | null;
    paidAt?: string | null;
    dueDate?: string | null;
    notes?: string | null;
    markPaid?: boolean;
  },
  actorId?: string,
) {
  if (data.amountCents <= 0) throw new Error("Tutar sıfırdan büyük olmalı.");

  let customerId = data.customerId ?? null;
  if (data.orderId) {
    const order = await db.order.findUnique({
      where: { id: data.orderId },
      select: { customerId: true },
    });
    if (!order) throw new Error("Sipariş bulunamadı.");
    customerId = order.customerId;
  }

  const paidAt =
    data.markPaid || data.paidAt
      ? data.paidAt
        ? new Date(data.paidAt)
        : new Date()
      : null;

  const payment = await db.payment.create({
    data: {
      orderId: data.orderId ?? null,
      customerId,
      amountCents: data.amountCents,
      direction: data.direction ?? "in",
      status: paidAt ? "paid" : "pending",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      paidAt,
      method: data.method ?? null,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      isApproved: paidAt != null,
    },
    include: {
      order: { select: { orderNo: true } },
      customer: { select: { name: true } },
    },
  });

  if (customerId) {
    await recalculateCustomerBalance(db, customerId);
  }

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "payment",
      entityId: payment.id,
      action: "create",
      changes: [
        {
          field: "amountCents",
          oldValue: null,
          newValue: String(data.amountCents),
        },
      ],
    });
  }

  return payment;
}

export async function updatePayment(
  db: Db,
  id: string,
  data: {
    amountCents?: number;
    status?: string;
    paidAt?: string | null;
    dueDate?: string | null;
    method?: string | null;
    reference?: string | null;
    notes?: string | null;
    isApproved?: boolean;
  },
  actorId?: string,
) {
  const existing = await db.payment.findUnique({ where: { id } });
  if (!existing) throw new Error("Ödeme bulunamadı.");

  const updates: {
    amountCents?: number;
    status?: string;
    paidAt?: Date | null;
    dueDate?: Date | null;
    method?: string | null;
    reference?: string | null;
    notes?: string | null;
    isApproved?: boolean;
  } = {};

  if (data.amountCents !== undefined) updates.amountCents = data.amountCents;
  if (data.status !== undefined) updates.status = data.status;
  if (data.paidAt !== undefined) {
    updates.paidAt = data.paidAt ? new Date(data.paidAt) : null;
    if (data.paidAt) updates.status = "paid";
  }
  if (data.dueDate !== undefined) {
    updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }
  if (data.method !== undefined) updates.method = data.method;
  if (data.reference !== undefined) updates.reference = data.reference;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isApproved !== undefined) updates.isApproved = data.isApproved;

  const payment = await db.payment.update({
    where: { id },
    data: updates,
    include: {
      order: { select: { orderNo: true } },
      customer: { select: { name: true } },
    },
  });

  if (payment.customerId) {
    await recalculateCustomerBalance(db, payment.customerId);
  }

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "payment",
      entityId: id,
      action: "update",
      changes: Object.keys(updates).map((field) => ({
        field,
        oldValue: String(existing[field as keyof typeof existing] ?? ""),
        newValue: String(updates[field as keyof typeof updates] ?? ""),
      })),
    });
  }

  return payment;
}

export async function recalculateCustomerBalance(db: Db, customerId: string) {
  const orders = await db.order.findMany({
    where: {
      customerId,
      status: { notIn: ["draft", "cancelled"] },
    },
  });

  const expectedTotal = orders.reduce((sum, order) => {
    const terms = parsePaymentTerms(order.paymentTerms);
    return sum + computeExpectedAmount(order.totalCents, terms.discountPercent);
  }, 0);

  const payments = await db.payment.findMany({
    where: {
      customerId,
      direction: "in",
      OR: [{ paidAt: { not: null } }, { status: "paid" }],
    },
  });

  const paidTotal = payments.reduce((s, p) => s + p.amountCents, 0);
  const balanceCents = expectedTotal - paidTotal;

  await db.customer.update({
    where: { id: customerId },
    data: { balanceCents },
  });

  return balanceCents;
}

export function serializePayment(row: {
  id: string;
  orderId: string | null;
  customerId: string | null;
  amountCents: number;
  direction: string;
  status: string;
  dueDate: Date | null;
  paidAt: Date | null;
  method: string | null;
  reference: string | null;
  isApproved: boolean;
  notes: string | null;
  createdAt: Date;
  order?: { orderNo: string } | null;
  customer?: { name: string } | null;
}): PaymentRow {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNo: row.order?.orderNo ?? null,
    customerId: row.customerId,
    customerName: row.customer?.name ?? null,
    amountCents: row.amountCents,
    direction: row.direction,
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    method: row.method,
    reference: row.reference,
    isApproved: row.isApproved,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
