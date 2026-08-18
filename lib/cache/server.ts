import { unstable_cache } from "next/cache";

/** Sunucu tarafı veri önbelleği süreleri (saniye) */
export const REVALIDATE = {
  dashboard: 30,
  orders: 20,
  stock: 30,
  production: 20,
  permissions: 120,
  reports: 60,
  live: 15,
} as const;

export function cachedQuery<T>(
  keyParts: string[],
  fn: () => Promise<T>,
  revalidate: number,
  tags: string[] = [],
): Promise<T> {
  return unstable_cache(fn, keyParts, { revalidate, tags })();
}

export function todayCacheKey(): string {
  return new Date().toISOString().slice(0, 10);
}
