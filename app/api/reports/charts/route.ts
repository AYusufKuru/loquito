import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildIncomeExpenseReport } from "@/lib/reports/income-expense";
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
    const { range } = parseReportQuery(searchParams);
    const report = await buildIncomeExpenseReport(prisma, range);
    return NextResponse.json({ report });
  } catch (error) {
    return reportError(error, "Gelir–gider verisi oluşturulamadı.");
  }
}
