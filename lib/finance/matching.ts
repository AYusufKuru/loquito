import type { PrismaClient } from "@prisma/client";

import {
  computeExpectedAmount,
  parsePaymentTerms,
} from "./payment-terms";

type Db = PrismaClient;

export interface MatchProposal {
  orderId: string | null;
  orderNo: string | null;
  paymentId: string | null;
  customerId: string | null;
  customerName: string | null;
  expectedCents: number | null;
  matchScore: number;
  matchReason: string;
}

const AMOUNT_TOLERANCE_CENTS = 100;

export async function proposePaymentMatch(
  db: Db,
  input: {
    amountCents: number;
    direction: "in" | "out";
    orderReference?: string | null;
    counterparty?: string | null;
    counterpartyCnpj?: string | null;
    controlNo?: string | null;
  },
): Promise<MatchProposal | null> {
  if (input.amountCents <= 0) return null;

  if (input.orderReference) {
    const order = await db.order.findFirst({
      where: { orderNo: input.orderReference },
      include: {
        customer: { select: { id: true, name: true } },
        payments: { where: { direction: input.direction } },
      },
    });
    if (order) {
      const terms = parsePaymentTerms(order.paymentTerms);
      const expected = computeExpectedAmount(
        order.totalCents,
        terms.discountPercent,
      );
      const payment =
        order.payments.find((p) => p.status !== "paid" && !p.paidAt) ??
        order.payments[0];

      const amountMatch =
        Math.abs(input.amountCents - expected) <= AMOUNT_TOLERANCE_CENTS ||
        Math.abs(input.amountCents - (payment?.amountCents ?? 0)) <=
          AMOUNT_TOLERANCE_CENTS;

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        paymentId: payment?.id ?? null,
        customerId: order.customerId,
        customerName: order.customer.name,
        expectedCents: payment?.amountCents ?? expected,
        matchScore: amountMatch ? 100 : 70,
        matchReason: amountMatch
          ? "Sipariş no ve tutar eşleşti"
          : "Sipariş no eşleşti; tutar farklı",
      };
    }
  }

  if (input.direction === "in") {
    const orders = await db.order.findMany({
      where: { status: { notIn: ["draft", "cancelled"] } },
      include: {
        customer: { select: { id: true, name: true, cnpj: true } },
        payments: { where: { direction: "in" } },
      },
      orderBy: { orderDate: "desc" },
      take: 100,
    });

    for (const order of orders) {
      const terms = parsePaymentTerms(order.paymentTerms);
      const expected = computeExpectedAmount(
        order.totalCents,
        terms.discountPercent,
      );
      const paid = order.payments
        .filter((p) => p.paidAt || p.status === "paid")
        .reduce((s, p) => s + p.amountCents, 0);
      const remaining = Math.max(0, expected - paid);

      const customerMatch =
        input.counterparty &&
        order.customer.name
          .toLowerCase()
          .includes(input.counterparty.toLowerCase().slice(0, 8));
      const cnpjMatch =
        input.counterpartyCnpj &&
        order.customer.cnpj?.replace(/\D/g, "") === input.counterpartyCnpj;
      const amountMatch =
        Math.abs(input.amountCents - remaining) <= AMOUNT_TOLERANCE_CENTS ||
        Math.abs(input.amountCents - expected) <= AMOUNT_TOLERANCE_CENTS;

      if (amountMatch || customerMatch || cnpjMatch) {
        const payment =
          order.payments.find((p) => p.status !== "paid" && !p.paidAt) ??
          order.payments[0];

        let score = 50;
        if (amountMatch) score += 30;
        if (customerMatch || cnpjMatch) score += 20;

        return {
          orderId: order.id,
          orderNo: order.orderNo,
          paymentId: payment?.id ?? null,
          customerId: order.customerId,
          customerName: order.customer.name,
          expectedCents: remaining > 0 ? remaining : expected,
          matchScore: score,
          matchReason:
            amountMatch && (customerMatch || cnpjMatch)
              ? "Tutar ve müşteri eşleşti"
              : amountMatch
                ? "Tutar eşleşti"
                : "Müşteri eşleşti",
        };
      }
    }
  }

  return null;
}
