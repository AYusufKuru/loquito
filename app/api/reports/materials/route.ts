import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildMaterialConsumptionReport } from "@/lib/reports/materials";
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
    const report = await buildMaterialConsumptionReport(prisma, range);
    return NextResponse.json({ report });
  } catch (error) {
    return reportError(error, "Malzeme tüketim raporu oluşturulamadı.");
  }
}
