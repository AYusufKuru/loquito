import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  buildFinishedStockMatrix,
  computeFinishedStockSummary,
  listFinishedStock,
  listReservations,
} from "@/lib/finished-stock/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const orderId = searchParams.get("orderId");

  if (view === "matrix") {
    const matrix = await buildFinishedStockMatrix(prisma);
    return NextResponse.json({ matrix });
  }

  if (view === "reservations") {
    const reservations = await listReservations(prisma, orderId ?? undefined);
    return NextResponse.json({ reservations });
  }

  const [rows, summary] = await Promise.all([
    listFinishedStock(prisma),
    computeFinishedStockSummary(prisma),
  ]);

  return NextResponse.json({ rows, summary });
}
