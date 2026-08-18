import type { PrismaClient } from "@prisma/client";

import { formatBrlFromCents } from "@/lib/stock/constants";

import {
  computeExpectedAmount,
  parsePaymentTerms,
} from "./payment-terms";
import { recalculateCustomerBalance } from "./payments";

type Db = PrismaClient;

export interface StatementLine {
  date: string;
  type: "order" | "payment";
  reference: string;
  description: string;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  balanceCents: number;
  totalDebitCents: number;
  totalCreditCents: number;
  lines: StatementLine[];
}

export async function buildCustomerStatement(
  db: Db,
  customerId: string,
): Promise<CustomerStatement | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true },
  });
  if (!customer) return null;

  await recalculateCustomerBalance(db, customerId);

  const orders = await db.order.findMany({
    where: {
      customerId,
      status: { notIn: ["draft", "cancelled"] },
    },
    orderBy: { orderDate: "asc" },
  });

  const payments = await db.payment.findMany({
    where: {
      customerId,
      direction: "in",
      OR: [{ paidAt: { not: null } }, { status: "paid" }],
    },
    include: { order: { select: { orderNo: true } } },
    orderBy: { paidAt: "asc" },
  });

  const events: Array<{
    date: Date;
    type: "order" | "payment";
    reference: string;
    description: string;
    debitCents: number;
    creditCents: number;
  }> = [];

  for (const order of orders) {
    const terms = parsePaymentTerms(order.paymentTerms);
    const expected = computeExpectedAmount(order.totalCents, terms.discountPercent);
    events.push({
      date: order.orderDate,
      type: "order",
      reference: order.orderNo,
      description: `Sipariş — ${terms.label}`,
      debitCents: expected,
      creditCents: 0,
    });
  }

  for (const payment of payments) {
    const paidAt = payment.paidAt ?? payment.createdAt;
    events.push({
      date: paidAt,
      type: "payment",
      reference: payment.order?.orderNo ?? payment.reference ?? payment.id,
      description: `Tahsilat — ${payment.method ?? "ödeme"}`,
      debitCents: 0,
      creditCents: payment.amountCents,
    });
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const lines: StatementLine[] = events.map((e) => {
    running += e.debitCents - e.creditCents;
    return {
      date: e.date.toISOString(),
      type: e.type,
      reference: e.reference,
      description: e.description,
      debitCents: e.debitCents,
      creditCents: e.creditCents,
      balanceCents: running,
    };
  });

  const totalDebitCents = events.reduce((s, e) => s + e.debitCents, 0);
  const totalCreditCents = events.reduce((s, e) => s + e.creditCents, 0);

  const updated = await db.customer.findUnique({
    where: { id: customerId },
    select: { balanceCents: true },
  });

  return {
    customerId: customer.id,
    customerName: customer.name,
    balanceCents: updated?.balanceCents ?? totalDebitCents - totalCreditCents,
    totalDebitCents,
    totalCreditCents,
    lines,
  };
}

export function formatStatementForPrint(statement: CustomerStatement): string {
  const header = `Cari Ekstre — ${statement.customerName}\n`;
  const body = statement.lines
    .map(
      (l) =>
        `${l.date.slice(0, 10)} | ${l.reference} | ${l.description} | Borç: ${formatBrlFromCents(l.debitCents)} | Alacak: ${formatBrlFromCents(l.creditCents)} | Bakiye: ${formatBrlFromCents(l.balanceCents)}`,
    )
    .join("\n");
  return `${header}\n${body}\n\nBakiye: ${formatBrlFromCents(statement.balanceCents)}`;
}
