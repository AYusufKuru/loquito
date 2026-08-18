import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  computeLineTotalCents,
  computeOrderTotals,
  marginPercent,
  quantityUnitForChannel,
  syncLineQuantities,
} from "@/lib/orders/compute";
import { ORDER_STATUSES, UNAPPROVED_STATUSES } from "@/lib/orders/constants";
import { getProductUnitCostCents } from "@/lib/orders/margin";
import { loadOrderDetail } from "@/lib/orders/load";
import { toOrderRow } from "@/lib/orders/serialize";
import type { OrderItemInput } from "@/lib/orders/types";
import { resolvePrice } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

function parseItems(input: unknown): OrderItemInput[] | null {
  if (!Array.isArray(input)) return null;
  const items: OrderItemInput[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const productId = typeof r.productId === "string" ? r.productId : "";
    if (!productId) continue;
    const quantityBoxes =
      typeof r.quantityBoxes === "number" ? r.quantityBoxes : Number(r.quantityBoxes);
    const quantityUnits =
      typeof r.quantityUnits === "number" ? r.quantityUnits : Number(r.quantityUnits);
    const unitPriceCents = Math.round(Number(r.unitPriceCents) || 0);
    const boxPriceCents = Math.round(Number(r.boxPriceCents) || 0);
    const discountPercent = Number(r.discountPercent) || 0;
    if (quantityBoxes <= 0 && quantityUnits <= 0) continue;
    items.push({
      productId,
      quantityBoxes: quantityBoxes || 0,
      quantityUnits: quantityUnits || 0,
      unitPriceCents,
      boxPriceCents,
      discountPercent,
      notes:
        typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
    });
  }
  return items.length > 0 ? items : null;
}

async function enrichItems(
  customerId: string,
  channel: string | null,
  items: OrderItemInput[],
  options: { canSetPrice: boolean; asOf: Date },
) {
  const enriched = [];
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

    const resolved = await resolvePrice(
      prisma,
      customerId,
      item.productId,
      inputMode === "unit" ? synced.quantityUnits : synced.quantityBoxes,
      quantityUnitForChannel(channel),
      options.asOf,
    );

    // Fiyat girme yetkisi olmayan kullanıcı çözümlenen fiyatı değiştiremez.
    const requestedUnitPrice = options.canSetPrice ? item.unitPriceCents : 0;
    const requestedBoxPrice = options.canSetPrice ? item.boxPriceCents : 0;

    const unitPriceCents = requestedUnitPrice || resolved.unitPriceCents || 0;
    const boxPriceCents =
      requestedBoxPrice ||
      resolved.boxPriceCents ||
      (unitsPerBox > 0 ? Math.round(unitPriceCents * unitsPerBox) : 0);

    const totalCents = computeLineTotalCents(
      synced.quantityBoxes,
      boxPriceCents,
      item.discountPercent,
    );

    const costUnitCents = await getProductUnitCostCents(prisma, item.productId);

    enriched.push({
      productId: item.productId,
      quantityBoxes: synced.quantityBoxes,
      quantityUnits: synced.quantityUnits,
      unitPriceCents,
      boxPriceCents,
      discountPercent: item.discountPercent,
      totalCents,
      notes: item.notes,
      product,
      listUnitPriceCents: resolved.unitPriceCents,
      listBoxPriceCents: resolved.boxPriceCents,
      costUnitCents,
      marginPercent: marginPercent(unitPriceCents, costUnitCents),
    });
  }
  return enriched;
}

export async function GET() {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const orders = await prisma.order.findMany({
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
    orderBy: [{ orderDate: "desc" }],
  });

  return NextResponse.json({ orders: orders.map(toOrderRow) });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    if (!customerId) {
      return NextResponse.json({ error: "Müşteri zorunludur." }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Geçersiz müşteri." }, { status: 400 });
    }

    const items = parseItems(body.items);
    if (!items) {
      return NextResponse.json({ error: "En az bir sipariş kalemi gerekli." }, { status: 400 });
    }

    const channel =
      typeof body.channel === "string" && body.channel ? body.channel : "retail_form";
    const discountCents = Math.round(Number(body.discountCents) || 0);
    const freightCents = Math.round(Number(body.freightCents) || 0);

    // Onay yetkisi olmayan kullanıcı siparişi doğrudan onaylı oluşturamaz.
    const requestedStatus =
      typeof body.status === "string" && ORDER_STATUSES.includes(body.status as never)
        ? body.status
        : "draft";
    const targetStatus =
      auth.session.canApproveOrder || UNAPPROVED_STATUSES.includes(requestedStatus)
        ? requestedStatus
        : "pending_approval";

    const orderDate = body.orderDate ? new Date(body.orderDate) : new Date();

    const enriched = await enrichItems(customerId, channel, items, {
      canSetPrice: auth.session.canSetPrice,
      asOf: orderDate,
    });
    const { totalCents } = computeOrderTotals(
      enriched,
      discountCents,
      freightCents,
    );

    const orderNo =
      typeof body.orderNo === "string" && body.orderNo.trim()
        ? body.orderNo.trim()
        : `PED-${Date.now().toString().slice(-8)}`;

    const existingNo = await prisma.order.findUnique({ where: { orderNo } });
    if (existingNo) {
      return NextResponse.json({ error: "Bu sipariş no zaten kullanılıyor." }, { status: 400 });
    }

    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId,
        status: targetStatus,
        channel,
        orderDate,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        paymentTerms:
          typeof body.paymentTerms === "string" && body.paymentTerms.trim()
            ? body.paymentTerms.trim()
            : customer.paymentTerms,
        freightType:
          typeof body.freightType === "string" && body.freightType.trim()
            ? body.freightType.trim()
            : customer.freightType,
        totalCents,
        discountCents,
        freightCents,
        notes:
          typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        items: {
          create: enriched.map((item) => ({
            productId: item.productId,
            quantityBoxes: item.quantityBoxes,
            quantityUnits: item.quantityUnits,
            unitPriceCents: item.unitPriceCents,
            boxPriceCents: item.boxPriceCents,
            discountPercent: item.discountPercent,
            totalCents: item.totalCents,
            notes: item.notes,
          })),
        },
      },
    });

    const detail = await loadOrderDetail(order.id);
    return NextResponse.json({ order: detail });
  } catch {
    return NextResponse.json({ error: "Sipariş oluşturulamadı." }, { status: 500 });
  }
}
