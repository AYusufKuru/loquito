import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { recordAudit } from "@/lib/audit/service";
import { getSession } from "@/lib/auth/session";
import { toOrderRow } from "@/lib/orders/serialize";
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

    // Durum değişikliği fiyatları etkilemediği için siparişi yeniden
    // fiyatlandırarak okumaya gerek yok; güncellenen satırın kendisi yeterli.
    // Denetim kaydı aynı transaction'da: durum değişip iz kalmaması olmaz.
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: {
          status: targetStatus,
          approvedAt: targetStatus === "approved" ? new Date() : existing.approvedAt,
          approvedById: targetStatus === "approved" ? session.userId : existing.approvedById,
        },
        include: {
          customer: { select: { name: true } },
          items: {
            select: {
              quantityBoxes: true,
              quantityUnits: true,
              product: { select: { sku: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      await recordAudit(tx, {
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

      return order;
    });

    return NextResponse.json({ order: toOrderRow(updated) });
  } catch {
    return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  }
}
