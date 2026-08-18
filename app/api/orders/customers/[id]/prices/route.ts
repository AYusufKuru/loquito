import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { diffPriceItems, recordAudit } from "@/lib/audit/service";
import { prisma } from "@/lib/prisma";
import { toCustomerPriceRow } from "@/lib/pricing/serialize";

type RouteContext = { params: Promise<{ id: string }> };

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCents(value: unknown): number | null {
  if (value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const { id: customerId } = await context.params;

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const items = body.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Geçersiz fiyat listesi." }, { status: 400 });
    }

    const oldPrices = await prisma.customerPrice.findMany({
      where: { customerId },
      include: { product: { select: { sku: true } } },
    });

    const oldRows = oldPrices.map((row) => ({
      productId: row.productId,
      sku: row.product.sku,
      boxPriceCents: row.boxPriceCents ?? 0,
      unitPriceCents: row.unitPriceCents ?? 0,
    }));

    await prisma.customerPrice.deleteMany({ where: { customerId } });

    const newRows: typeof oldRows = [];
    for (const row of items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      if (!productId) continue;

      const boxPriceCents = parseCents(r.boxPriceCents);
      const unitPriceCents = parseCents(r.unitPriceCents);
      if (boxPriceCents === null && unitPriceCents === null) continue;

      await prisma.customerPrice.create({
        data: {
          customerId,
          productId,
          boxPriceCents,
          unitPriceCents,
          validFrom: parseDate(r.validFrom),
          validTo: parseDate(r.validTo),
          notes:
            typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
        },
      });

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { sku: true },
      });
      newRows.push({
        productId,
        sku: product?.sku ?? productId,
        boxPriceCents: boxPriceCents ?? 0,
        unitPriceCents: unitPriceCents ?? 0,
      });
    }

    const priceChanges = diffPriceItems(customer.name, oldRows, newRows);
    await recordAudit(prisma, {
      userId: auth.session.userId,
      entityType: "customer_price",
      entityId: customerId,
      action: "update",
      changes: priceChanges,
    });

    const prices = await prisma.customerPrice.findMany({
      where: { customerId },
      include: { product: { select: { sku: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ customerPrices: prices.map(toCustomerPriceRow) });
  } catch {
    return NextResponse.json({ error: "Özel fiyatlar kaydedilemedi." }, { status: 500 });
  }
}
