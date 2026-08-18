export const EXPENSE_CATEGORIES = [
  { value: "personel", label: "Personel" },
  { value: "kira", label: "Kira" },
  { value: "enerji", label: "Enerji" },
  { value: "iletişim", label: "İletişim" },
  { value: "araç", label: "Araç" },
  { value: "hizmet", label: "Hizmet" },
  { value: "other", label: "Diğer" },
] as const;

export const OVERHEAD_ALLOCATION_METHODS = [
  { value: "kg", label: "Üretilen kg" },
  { value: "hours", label: "Çalışılan saat" },
] as const;

export const OVERHEAD_METHOD_SETTING_KEY = "overhead_allocation_method";

/**
 * Maaş ve yan haklar sipariş analizinde doğrudan işçilik olarak ayrıca
 * hesaplandığı için, siparişe dağıtılan genel gider havuzundan çıkarılır.
 * Aylık gelir-gider raporunda havuzun tamamı kullanılmaya devam eder.
 */
export const DIRECT_LABOR_EXPENSE_CATEGORY = "personel";

export function formatPeriodMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parsePeriodMonth(periodMonth: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export const FIXED_EXPENSE_DEMO_MONTH = "2026-02";

export function currentPeriodMonth(): string {
  return formatPeriodMonth(new Date());
}
