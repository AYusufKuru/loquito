import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { getOrderShippingProgress } from "@/lib/shipments/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireApiPermission("shipments", "view");
  if (auth.error) return auth.error;

  const { orderId } = await params;
  const progress = await getOrderShippingProgress(prisma, orderId);
  if (!progress) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ progress });
}
