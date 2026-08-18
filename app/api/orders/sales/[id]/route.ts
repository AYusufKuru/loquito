import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  canTransition,
  requiresApprovalRight,
  type OrderStatus,
} from "@/lib/orders/constants";
import { loadOrderDetail } from "@/lib/orders/load";
import {
  computeLineTotalCents,
  computeOrderTotals,
  quantityUnitForChannel,
  syncLineQuantities,
} from "@/lib/orders/compute";
import type { OrderItemInput } from "@/lib/orders/types";
import { resolvePrice } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function parseItems(input: unknown): OrderItemInput[] | null {
  if (!Array.isArray(input)) return null;
  const items: OrderItemInput[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const productId = typeof r.productId === "string" ? r.productId : "";
    if (!productId) continue;
    items.push({
      productId,
      quantityBoxes: Number(r.quantityBoxes) || 0,
      quantityUnits: Math.round(Number(r.quantityUnits) || 0),
      unitPriceCents: Math.round(Number(r.unitPriceCents) || 0),
      boxPriceCents: Math.round(Number(r.boxPriceCents) || 0),
      discountPercent: Number(r.discountPercent) || 0,
      notes:
        typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
    });
  }
  return items.length > 0 ? items : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const detail = await loadOrderDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ order: detail });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const session = auth.session;
  const { id } = await context.params;

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }

    if (existing.status !== "draft" && existing.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Yalnızca taslak veya onay bekleyen sipariş düzenlenebilir." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const items = parseItems(body.items);
    if (!items) {
      return NextResponse.json({ error: "Geçersiz kalemler." }, { status: 400 });
    }

    const channel =
      typeof body.channel === "string" ? body.channel : existing.channel;
    const discountCents =
      body.discountCents !== undefined
        ? Math.round(Number(body.discountCents) || 0)
        : existing.discountCents;
    const freightCents =
      body.freightCents !== undefined
        ? Math.round(Number(body.freightCents) || 0)
        : existing.freightCents;

    const enriched: Array<{
      productId: string;
      quantityBoxes: number;
      quantityUnits: number;
      unitPriceCents: number;
      boxPriceCents: number;
      discountPercent: number;
      totalCents: number;
      notes: string | null;
    }> = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { packaging: true },
      });
      if (!product) continue;

      const unitsPerBox = product.packaging?.unitsPerBox ?? 0;
      const inputMode = quantityUnitForChannel(channel) === "unit" ? "unit" : "box";
      const synced = syncLineQuantities(
        inputMode,
        item.quantityBoxes,
        item.quantityUnits,
        unitsPerBox,
      );

      let unitPriceCents = item.unitPriceCents;
      let boxPriceCents = item.boxPriceCents;

      if (!session.canSetPrice) {
        const resolved = await resolvePrice(
          prisma,
          existing.customerId,
          item.productId,
          inputMode === "unit" ? synced.quantityUnits : synced.quantityBoxes,
          quantityUnitForChannel(channel),
          existing.orderDate,
        );
        unitPriceCents = resolved.unitPriceCents ?? unitPriceCents;
        boxPriceCents =
          resolved.boxPriceCents ??
          (unitsPerBox > 0
            ? Math.round(unitPriceCents * unitsPerBox)
            : boxPriceCents);
      }

      enriched.push({
        productId: item.productId,
        quantityBoxes: synced.quantityBoxes,
        quantityUnits: synced.quantityUnits,
        unitPriceCents,
        boxPriceCents,
        discountPercent: item.discountPercent,
        totalCents: computeLineTotalCents(
          synced.quantityBoxes,
          boxPriceCents,
          item.discountPercent,
        ),
        notes: item.notes ?? null,
      });
    }

    const { totalCents } = computeOrderTotals(enriched, discountCents, freightCents);

    let newStatus = existing.status;
    if (typeof body.status === "string" && body.status !== existing.status) {
      const to = body.status as OrderStatus;
      if (requiresApprovalRight(to) && !session.canApproveOrder) {
        return NextResponse.json(
          { error: "Sipariş onay yetkiniz yok." },
          { status: 403 },
        );
      }
      if (canTransition(existing.status as OrderStatus, to)) {
        newStatus = to;
      }
    }

    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
        channel,
        deliveryDate: body.deliveryDate
          ? new Date(body.deliveryDate)
          : existing.deliveryDate,
        paymentTerms:
          typeof body.paymentTerms === "string"
            ? body.paymentTerms.trim() || null
            : existing.paymentTerms,
        freightType:
          typeof body.freightType === "string"
            ? body.freightType.trim() || null
            : existing.freightType,
        totalCents,
        discountCents,
        freightCents,
        notes:
          typeof body.notes === "string" ? body.notes.trim() || null : existing.notes,
        items: {
          create: enriched,
        },
      },
    });

    const detail = await loadOrderDetail(id);
    return NextResponse.json({ order: detail });
  } catch {
    return NextResponse.json({ error: "Sipariş güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  if (existing.status !== "draft" && existing.status !== "cancelled") {
    await prisma.order.update({ where: { id }, data: { status: "cancelled" } });
    return NextResponse.json({ success: true, cancelled: true });
  }

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
