import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  releaseOrderReservations,
  reserveStockForOrder,
} from "@/lib/finished-stock/service";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const orderId = typeof body.orderId === "string" ? body.orderId : "";

    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli." }, { status: 400 });
    }

    if (body.action === "release") {
      const count = await releaseOrderReservations(prisma, orderId);
      return NextResponse.json({ released: count });
    }

    const result = await reserveStockForOrder(prisma, orderId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rezervasyon başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
