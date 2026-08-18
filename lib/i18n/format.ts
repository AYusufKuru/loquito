import type { Locale } from "./locale";
import { INTL_LOCALE } from "./locale";

export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat(
    INTL_LOCALE[locale],
    options ?? { dateStyle: "medium" },
  ).format(d);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

export function formatCurrency(
  cents: number,
  locale: Locale,
  currency = "BRL",
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDecimal(
  value: number,
  locale: Locale,
  fractionDigits = 1,
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
