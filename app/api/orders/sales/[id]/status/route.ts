import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { recordAudit } from "@/lib/audit/service";
import { getSession } from "@/lib/auth/session";
import { loadOrderDetail } from "@/lib/orders/load";
import { canTransition, type OrderStatus } from "@/lib/orders/constants";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "approve");
  if (auth.error) return auth.error;

  const session = await getSession();
  if (!session?.canApproveOrder) {
    return NextResponse.json({ error: "Sipariş onay yetkiniz yok." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const targetStatus =
      typeof body.status === "string" ? (body.status as OrderStatus) : "approved";

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }

    if (!canTransition(existing.status as OrderStatus, targetStatus)) {
      return NextResponse.json({ error: "Bu durum geçişi geçerli değil." }, { status: 400 });
    }

    await prisma.order.update({
      where: { id },
      data: {
        status: targetStatus,
        approvedAt: targetStatus === "approved" ? new Date() : existing.approvedAt,
        approvedById: targetStatus === "approved" ? session.userId : existing.approvedById,
      },
    });

    await recordAudit(prisma, {
      userId: session.userId,
      entityType: "order",
      entityId: id,
      action: "status_change",
      changes: [
        {
          field: "status",
          oldValue: existing.status,
          newValue: targetStatus,
        },
      ],
    });

    const detail = await loadOrderDetail(id);
    return NextResponse.json({ order: detail });
  } catch {
    return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  }
}
