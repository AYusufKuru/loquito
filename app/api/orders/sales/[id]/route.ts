import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  canTransition,
  requiresApprovalRight,
  type OrderStatus,
} from "@/lib/orders/constants";
import { loadOrderDetail } from "@/lib/orders/load";
import { findProductsByIds } from "@/lib/orders/products";
import {
  completeUnitBoxPrices,
  computeLineTotalCents,
  computeOrderTotals,
  quantityUnitForChannel,
  syncLineQuantities,
} from "@/lib/orders/compute";
import type { OrderItemInput } from "@/lib/orders/types";
import { resolvePrices } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";
import { resolveTaxSnapshot } from "@/lib/finance/tax-locations";

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
    const requestedTaxLocationId =
      body.taxLocationId !== undefined
        ? typeof body.taxLocationId === "string" && body.taxLocationId.trim()
          ? body.taxLocationId.trim()
          : null
        : existing.taxLocationId;
    const tax = await resolveTaxSnapshot(prisma, requestedTaxLocationId, {
      allowInactive: requestedTaxLocationId === existing.taxLocationId,
    });
    if (!tax.taxLocationId) {
      return NextResponse.json({ error: "KDV konumu zorunludur." }, { status: 400 });
    }

    const products = await findProductsByIds(items.map((item) => item.productId));
    const quantityUnit = quantityUnitForChannel(channel);
    const inputMode = quantityUnit === "unit" ? "unit" : "box";

    const prepared = [];
    for (const item of items) {
      const product = products.get(item.productId);
      if (!product) continue;
      const unitsPerBox = product.packaging?.unitsPerBox ?? 0;
      const synced = syncLineQuantities(
        inputMode,
        item.quantityBoxes,
        item.quantityUnits,
        unitsPerBox,
      );
      prepared.push({ item, unitsPerBox, synced });
    }

    const resolvedPrices = session.canSetPrice
      ? []
      : await resolvePrices(
          prisma,
          existing.customerId,
          prepared.map(({ item, synced }) => ({
            productId: item.productId,
            quantity:
              inputMode === "unit" ? synced.quantityUnits : synced.quantityBoxes,
            quantityUnit,
          })),
          existing.orderDate,
        );

    const enriched = prepared.map(({ item, unitsPerBox, synced }, index) => {
      let unitPriceCents = item.unitPriceCents;
      let boxPriceCents = item.boxPriceCents;

      if (!session.canSetPrice) {
        const resolved = resolvedPrices[index];
        unitPriceCents = resolved?.unitPriceCents ?? unitPriceCents;
        boxPriceCents = resolved?.boxPriceCents ?? boxPriceCents;
      }

      const completed = completeUnitBoxPrices(
        unitPriceCents,
        boxPriceCents,
        unitsPerBox,
      );
      unitPriceCents = completed.unitPriceCents;
      boxPriceCents = completed.boxPriceCents;

      return {
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
      };
    });

    const { totalCents, taxCents } = computeOrderTotals(
      enriched,
      discountCents,
      freightCents,
      tax.taxPercent,
    );

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

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.update({
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
          taxLocationId: tax.taxLocationId,
          taxPercent: tax.taxPercent,
          taxCents,
          notes:
            typeof body.notes === "string" ? body.notes.trim() || null : existing.notes,
          items: {
            create: enriched,
          },
        },
      });
    });

    const detail = await loadOrderDetail(id);
    return NextResponse.json({ order: detail });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sipariş güncellenemedi.";
    const clientError = message.includes("KDV") || message.includes("konum");
    return NextResponse.json(
      { error: message },
      { status: clientError ? 400 : 500 },
    );
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
