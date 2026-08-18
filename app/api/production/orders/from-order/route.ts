import { NextResponse } from "next/server";

import { getRolePermissions, hasPermission } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { createProductionOrdersFromOrder } from "@/lib/production/create-order";
import { serializeProductionOrder } from "@/lib/production/serialize";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const permissions = await getRolePermissions(session.roleId);
  const allowed =
    hasPermission(permissions, "production", "create") ||
    hasPermission(permissions, "orders", "approve");

  if (!allowed) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const orderId = typeof body.orderId === "string" ? body.orderId : "";

    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli." }, { status: 400 });
    }

    const created = await createProductionOrdersFromOrder(prisma, orderId);

    return NextResponse.json({
      orders: created.map(serializeProductionOrder),
      count: created.length,
      stockOnly: created.length === 0,
      orderStatus: created.length > 0 ? "in_production" : "ready_ship",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Üretim emirleri oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
