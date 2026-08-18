import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toPriceTierRow } from "@/lib/pricing/serialize";
import type { QuantityUnit } from "@/lib/pricing/types";

type RouteContext = { params: Promise<{ id: string }> };

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
      return NextResponse.json({ error: "Geçersiz kademe listesi." }, { status: 400 });
    }

    await prisma.priceTier.deleteMany({ where: { customerId } });

    for (const row of items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const thresholdQty =
        typeof r.thresholdQty === "number" ? r.thresholdQty : Number(r.thresholdQty);
      if (!Number.isFinite(thresholdQty) || thresholdQty <= 0) continue;

      const thresholdUnit: QuantityUnit =
        r.thresholdUnit === "unit" ? "unit" : "box";

      const productId =
        typeof r.productId === "string" && r.productId ? r.productId : null;

      const discountPercent =
        r.discountPercent === null || r.discountPercent === ""
          ? null
          : typeof r.discountPercent === "number"
            ? r.discountPercent
            : Number(r.discountPercent);

      const boxPriceCents =
        r.boxPriceCents === null || r.boxPriceCents === ""
          ? null
          : Math.round(Number(r.boxPriceCents));
      const unitPriceCents =
        r.unitPriceCents === null || r.unitPriceCents === ""
          ? null
          : Math.round(Number(r.unitPriceCents));

      await prisma.priceTier.create({
        data: {
          customerId,
          productId,
          thresholdQty,
          thresholdUnit,
          discountPercent:
            discountPercent != null && Number.isFinite(discountPercent)
              ? discountPercent
              : null,
          boxPriceCents:
            boxPriceCents != null && Number.isFinite(boxPriceCents)
              ? boxPriceCents
              : null,
          unitPriceCents:
            unitPriceCents != null && Number.isFinite(unitPriceCents)
              ? unitPriceCents
              : null,
          notes:
            typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
        },
      });
    }

    const tiers = await prisma.priceTier.findMany({
      where: { customerId },
      include: { product: { select: { sku: true, name: true } } },
      orderBy: { thresholdQty: "asc" },
    });

    return NextResponse.json({ priceTiers: tiers.map(toPriceTierRow) });
  } catch {
    return NextResponse.json({ error: "Kademeler kaydedilemedi." }, { status: 500 });
  }
}
