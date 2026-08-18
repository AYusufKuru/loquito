export const REPORT_PERIODS = [
  { value: "day", label: "Gün" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Ay" },
  { value: "year", label: "Yıl" },
  { value: "custom", label: "Özel aralık" },
] as const;

export const REPORT_GROUP_BY = [
  { value: "order", label: "Sipariş" },
  { value: "product", label: "Ürün" },
  { value: "flavor", label: "Lezzet" },
  { value: "packaging", label: "Gramaj" },
  { value: "customer", label: "Müşteri" },
  { value: "channel", label: "Kanal" },
  { value: "salesRep", label: "Temsilci" },
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number]["value"];
export type ReportGroupBy = (typeof REPORT_GROUP_BY)[number]["value"];

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseAnchorDate(value?: string): Date {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function parseReportRange(
  period: ReportPeriod,
  options?: { date?: string; from?: string; to?: string },
): DateRange {
  const anchor = parseAnchorDate(options?.date);

  if (period === "custom") {
    const from = options?.from ? new Date(options.from) : anchor;
    const to = options?.to ? new Date(options.to) : anchor;
    return {
      start: startOfDay(from),
      end: endOfDay(to),
      label: `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`,
    };
  }

  if (period === "day") {
    return {
      start: startOfDay(anchor),
      end: endOfDay(anchor),
      label: anchor.toISOString().slice(0, 10),
    };
  }

  if (period === "week") {
    const d = startOfDay(anchor);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return {
      start: d,
      end: endOfDay(end),
      label: `${d.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)}`,
    };
  }

  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    return { start: startOfDay(start), end: endOfDay(end), label };
  }

  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear(), 11, 31);
  return {
    start: startOfDay(start),
    end: endOfDay(end),
    label: String(anchor.getFullYear()),
  };
}

export function monthsInRange(range: DateRange): string[] {
  const months: string[] = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const endMonth = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}
