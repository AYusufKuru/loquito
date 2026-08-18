import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { analyzeOrderProduction } from "@/lib/orders/production-analysis";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const analysis = await analyzeOrderProduction(prisma, id);

  if (!analysis) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ analysis });
}
