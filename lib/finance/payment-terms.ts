export const CASH_DISCOUNT_PERCENT = 3;

export interface ParsedPaymentTerms {
  label: string;
  discountPercent: number;
  days: number;
  method: string | null;
}

export function parsePaymentTerms(terms: string | null | undefined): ParsedPaymentTerms {
  const raw = (terms ?? "").toLowerCase().trim();
  if (!raw) {
    return { label: "30 gün", discountPercent: 0, days: 30, method: "transfer" };
  }

  if (raw.includes("%3") || raw.includes("peşin") || raw.includes("pesin")) {
    const method = raw.includes("pix") ? "pix" : "transfer";
    return {
      label: "Peşin %3 iskonto",
      discountPercent: CASH_DISCOUNT_PERCENT,
      days: 0,
      method,
    };
  }

  const numbers = raw.match(/\d+/g)?.map(Number) ?? [];
  const days = numbers.length > 0 ? Math.max(...numbers) : 30;

  if (days >= 60) {
    return { label: "30-45-60 gün", discountPercent: 0, days: 60, method: "transfer" };
  }
  if (days >= 45) {
    return { label: "30-45 gün", discountPercent: 0, days: 45, method: "transfer" };
  }
  if (days >= 30) {
    return { label: "30 gün", discountPercent: 0, days: 30, method: "transfer" };
  }

  return { label: terms ?? "Vadeli", discountPercent: 0, days: days || 30, method: "transfer" };
}

export function computeExpectedAmount(
  totalCents: number,
  discountPercent: number,
): number {
  if (discountPercent <= 0) return totalCents;
  return Math.round(totalCents * (1 - discountPercent / 100));
}

export function computeDueDate(baseDate: Date, days: number): Date {
  const due = new Date(baseDate);
  due.setDate(due.getDate() + days);
  return due;
}

export type PaymentStatusKey = "pending" | "partial" | "paid" | "overdue";

export function computePaymentStatus(
  expectedCents: number,
  paidCents: number,
  dueDate: Date | null,
): PaymentStatusKey {
  if (expectedCents <= 0) return "paid";
  if (paidCents >= expectedCents) return "paid";
  if (paidCents > 0) {
    if (dueDate && dueDate < new Date() && paidCents < expectedCents) return "overdue";
    return "partial";
  }
  if (dueDate && dueDate < startOfToday()) return "overdue";
  return "pending";
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntilDue(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const today = startOfToday();
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
