import type { ReportPeriod } from "@/lib/reports/constants";

import { validatePeriodMonth } from "./finance-validation";
import { buildErrors, required, type FieldErrors } from "./validation";

export interface ReportFilterInput {
  period: ReportPeriod;
  date: string;
  from: string;
  to: string;
}

export function validateReportFilter(
  filter: ReportFilterInput,
  labels?: {
    fromDate?: string;
    toDate?: string;
    periodMonth?: string;
    anchorDate?: string;
  },
): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  if (filter.period === "custom") {
    entries.push(["from", required(filter.from, labels?.fromDate ?? "Başlangıç tarihi")]);
    entries.push(["to", required(filter.to, labels?.toDate ?? "Bitiş tarihi")]);
    if (filter.from && filter.to && filter.from > filter.to) {
      entries.push(["to", "Bitiş tarihi başlangıçtan önce olamaz."]);
    }
  } else if (filter.period === "month" || filter.period === "year") {
    const monthErr = validatePeriodMonth(
      filter.date.slice(0, 7),
      labels?.periodMonth ?? "Dönem",
    );
    if (monthErr?.periodMonth) {
      entries.push(["date", monthErr.periodMonth]);
    }
  } else {
    entries.push(["date", required(filter.date, labels?.anchorDate ?? "Tarih")]);
  }

  return buildErrors(entries);
}
