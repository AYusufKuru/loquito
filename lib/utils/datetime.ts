/** Prisma Date veya önbellekten gelen ISO string değerini ISO string'e çevirir. */
export function toIsoString(
  value: Date | string | null | undefined,
): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

/** YYYY-MM-DD formatında tarih döner. */
export function toDateOnlyString(
  value: Date | string | null | undefined,
): string | null {
  const iso = toIsoString(value);
  return iso ? iso.slice(0, 10) : null;
}
