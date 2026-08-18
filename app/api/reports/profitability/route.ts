import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildProfitabilityReport } from "@/lib/reports/profitability";
import {
  parseReportQuery,
  requireReportsView,
  reportError,
} from "@/lib/reports/api-helpers";

export async function GET(request: Request) {
  const auth = await requireReportsView();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const { range, groupBy } = parseReportQuery(searchParams);
    const report = await buildProfitabilityReport(prisma, range, groupBy);
    return NextResponse.json({ report });
  } catch (error) {
    return reportError(error, "Kârlılık raporu oluşturulamadı.");
  }
}
