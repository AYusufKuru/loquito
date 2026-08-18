import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { diffPriceItems, recordAudit } from "@/lib/audit/service";
import { prisma } from "@/lib/prisma";
import { toPriceListItemRow } from "@/lib/pricing/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const { id: priceListId } = await context.params;

  try {
    const list = await prisma.priceList.findUnique({ where: { id: priceListId } });
    if (!list) {
      return NextResponse.json({ error: "Fiyat listesi bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const items = body.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Geçersiz kalem listesi." }, { status: 400 });
    }

    const oldItems = await prisma.priceListItem.findMany({
      where: { priceListId },
      include: { product: { select: { sku: true } } },
    });

    const oldRows = oldItems.map((row) => ({
      productId: row.productId,
      sku: row.product.sku,
      boxPriceCents: row.boxPriceCents,
      unitPriceCents: row.unitPriceCents,
    }));

    await prisma.priceListItem.deleteMany({ where: { priceListId } });

    const newRows: typeof oldRows = [];
    for (const row of items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      if (!productId) continue;

      const boxPriceCents = Math.round(Number(r.boxPriceCents) || 0);
      const unitPriceCents = Math.round(Number(r.unitPriceCents) || 0);
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { sku: true },
      });

      await prisma.priceListItem.create({
        data: {
          priceListId,
          productId,
          boxPriceCents,
          unitPriceCents,
        },
      });

      newRows.push({
        productId,
        sku: product?.sku ?? productId,
        boxPriceCents,
        unitPriceCents,
      });
    }

    const priceChanges = diffPriceItems(list.code, oldRows, newRows);
    await recordAudit(prisma, {
      userId: auth.session.userId,
      entityType: "price_list",
      entityId: priceListId,
      action: "update",
      changes: priceChanges,
    });

    const saved = await prisma.priceListItem.findMany({
      where: { priceListId },
      include: { product: { select: { sku: true, name: true } } },
      orderBy: { product: { sku: "asc" } },
    });

    return NextResponse.json({ items: saved.map(toPriceListItemRow) });
  } catch {
    return NextResponse.json({ error: "Liste kalemleri kaydedilemedi." }, { status: 500 });
  }
}
