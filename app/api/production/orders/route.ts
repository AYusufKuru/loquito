import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { productionOrderInclude } from "@/lib/production/create-order";
import { serializeProductionOrder } from "@/lib/production/serialize";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("production", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status");

  const orders = await prisma.productionOrder.findMany({
    where: {
      orderId: orderId ?? undefined,
      status: status ?? undefined,
    },
    include: productionOrderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    orders: orders.map(serializeProductionOrder),
  });
}
