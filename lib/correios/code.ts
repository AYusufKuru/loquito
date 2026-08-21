/** Correios nesne kodu: 2 harf + 9 rakam + 2 harf (örn. AA123456789BR). */
export const CORREIOS_TRACKING_CODE_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export function normalizeTrackingNo(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isCorreiosTrackingCode(raw: string): boolean {
  return CORREIOS_TRACKING_CODE_RE.test(normalizeTrackingNo(raw));
}
