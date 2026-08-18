import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { computeStockAlerts, computeStockValuation } from "@/lib/stock/inventory";

export async function GET() {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const [valuation, alerts] = await Promise.all([
    computeStockValuation(),
    computeStockAlerts(),
  ]);

  const quarantineLotCount = await prisma.materialLot.count({
    where: { status: "quarantine", quantity: { gt: 0 } },
  });

  return NextResponse.json({
    summary: {
      totalValueCents: valuation.totalValueCents,
      availableValueCents: valuation.availableValueCents,
      materialCount: valuation.materialCount,
      alertCount: alerts.length,
      quarantineLotCount,
      alerts: alerts.map((a) => ({
        type: a.type,
        message: a.message,
        severity: a.severity,
      })),
    },
  });
}
