import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { productionOrderInclude } from "@/lib/production/create-order";
import { serializeProductionOrder } from "@/lib/production/serialize";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("production", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const order = await prisma.productionOrder.findUnique({
    where: { id },
    include: productionOrderInclude,
  });

  if (!order) {
    return NextResponse.json({ error: "Üretim emri bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ order: serializeProductionOrder(order) });
}
