export type WorkDaysPattern = "mon-fri" | "all";

export function isWorkDay(date: Date, pattern: WorkDaysPattern = "mon-fri"): boolean {
  if (pattern === "all") return true;
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function normalizeToWorkDay(date: Date, pattern: WorkDaysPattern = "mon-fri"): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  while (!isWorkDay(d, pattern)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function advanceWorkDays(
  start: Date,
  workDaysToAdd: number,
  pattern: WorkDaysPattern = "mon-fri",
): Date {
  const d = new Date(start);
  d.setHours(12, 0, 0, 0);
  let added = 0;
  while (added < workDaysToAdd) {
    d.setDate(d.getDate() + 1);
    if (isWorkDay(d, pattern)) added++;
  }
  return d;
}

export function workDayToDate(
  start: Date,
  workDayIndex: number,
  pattern: WorkDaysPattern = "mon-fri",
): Date {
  const normalized = normalizeToWorkDay(start, pattern);
  if (workDayIndex <= 1) return normalized;
  return advanceWorkDays(normalized, workDayIndex - 1, pattern);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseWorkDaysPattern(value: string): WorkDaysPattern {
  return value === "all" ? "all" : "mon-fri";
}
