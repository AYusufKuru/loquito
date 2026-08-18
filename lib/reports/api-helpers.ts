import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  parseReportRange,
  type ReportGroupBy,
  type ReportPeriod,
} from "@/lib/reports/constants";

export function parseReportQuery(searchParams: URLSearchParams) {
  const period = (searchParams.get("period") ?? "month") as ReportPeriod;
  const date = searchParams.get("date") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const groupBy = (searchParams.get("groupBy") ?? "order") as ReportGroupBy;
  const range = parseReportRange(period, { date, from, to });
  return { period, date, from, to, groupBy, range };
}

export async function requireReportsView() {
  return requireApiPermission("reports", "view");
}

export function reportError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
