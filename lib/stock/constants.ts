export const MATERIAL_CATEGORIES = ["raw", "packaging"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const RAW_SUBCATEGORIES = [
  { value: "sugar", label: "Şeker" },
  { value: "starch", label: "Nişasta" },
  { value: "water", label: "Su" },
  { value: "acid", label: "Asit / Tuz" },
  { value: "coffee", label: "Kahve" },
  { value: "peanut", label: "Fıstık / Kaju" },
  { value: "fruit", label: "Meyve" },
  { value: "other", label: "Diğer" },
] as const;

export const PACKAGING_SUBCATEGORIES = [
  { value: "box", label: "Kutu" },
  { value: "cradle", label: "Beşik" },
  { value: "ship_box", label: "Nakliye Kolisi" },
  { value: "gelatin", label: "Jelatin" },
  { value: "other", label: "Diğer" },
] as const;

export const MATERIAL_UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "L", label: "L" },
  { value: "adet", label: "adet" },
  { value: "m", label: "m" },
] as const;

import { formatCurrency } from "@/lib/i18n/format";
import { getServerLocale } from "@/lib/i18n/request-locale";

export function formatBrlFromCents(cents: number): string {
  return formatCurrency(cents, getServerLocale(), "BRL");
}

export function parseBrlToCents(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
