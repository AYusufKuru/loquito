import { unstable_cache } from "next/cache";

/**
 * Operasyonel veriler (sipariş, stok, üretim, rapor) her istekte tazeden
 * okunur; ISR/stale-while-revalidate eski kayıtları ekranda tutuyordu.
 * Yalnızca nadiren değişen ve her API çağrısında tekrarlanan sorgular
 * önbelleklenir.
 */
export const REVALIDATE = {
  dashboard: 0,
  orders: 0,
  stock: 0,
  production: 0,
  permissions: 300,
  reports: 0,
  live: 0,
} as const;

/** Rol yetkileri değiştiğinde bu etiket geçersiz kılınır. */
export const PERMISSIONS_TAG = "permissions";

export function cachedQuery<T>(
  keyParts: string[],
  fn: () => Promise<T>,
  revalidate = 0,
  tags: string[] = [],
): Promise<T> {
  if (revalidate <= 0) return fn();
  return unstable_cache(fn, keyParts, { revalidate, tags })();
}

export function todayCacheKey(): string {
  return new Date().toISOString().slice(0, 10);
}
