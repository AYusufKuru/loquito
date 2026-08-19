import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  completeUnitBoxPrices,
  computeLineTotalCents,
  marginPercent,
  quantityUnitForChannel,
  syncLineQuantities,
} from "@/lib/orders/compute";
import { getProductUnitCostCents } from "@/lib/orders/margin";
import { resolvePrice } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const channel =
      typeof body.channel === "string" ? body.channel : "retail_form";
    const quantityBoxes = Number(body.quantityBoxes) || 0;
    const quantityUnits = Math.round(Number(body.quantityUnits) || 0);
    const unitPriceCents =
      body.unitPriceCents !== undefined
        ? Math.round(Number(body.unitPriceCents) || 0)
        : null;

    if (!customerId || !productId) {
      return NextResponse.json({ error: "Geçersiz parametreler." }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { packaging: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }

    const unitsPerBox = product.packaging?.unitsPerBox ?? 0;
    const inputMode = quantityUnitForChannel(channel) === "unit" ? "unit" : "box";
    const synced = syncLineQuantities(
      inputMode,
      quantityBoxes,
      quantityUnits,
      unitsPerBox,
    );

    const resolved = await resolvePrice(
      prisma,
      customerId,
      productId,
      inputMode === "unit" ? synced.quantityUnits : synced.quantityBoxes,
      quantityUnitForChannel(channel),
    );

    const completed = completeUnitBoxPrices(
      unitPriceCents ?? resolved.unitPriceCents ?? 0,
      resolved.boxPriceCents ?? 0,
      unitsPerBox,
    );
    const finalUnitPrice = completed.unitPriceCents;
    const finalBoxPrice = completed.boxPriceCents;
    const discountPercent = Number(body.discountPercent) || 0;
    const totalCents = computeLineTotalCents(
      synced.quantityBoxes,
      finalBoxPrice,
      discountPercent,
    );
    const costUnitCents = await getProductUnitCostCents(prisma, productId);

    return NextResponse.json({
      quantityBoxes: synced.quantityBoxes,
      quantityUnits: synced.quantityUnits,
      unitsPerBox,
      unitPriceCents: finalUnitPrice,
      boxPriceCents: finalBoxPrice,
      listUnitPriceCents: resolved.unitPriceCents,
      listBoxPriceCents: resolved.boxPriceCents,
      totalCents,
      costUnitCents,
      marginPercent: marginPercent(finalUnitPrice, costUnitCents),
      priceSource: resolved.source,
      priceSourceDetail: resolved.sourceDetail,
    });
  } catch {
    return NextResponse.json({ error: "Önizleme hesaplanamadı." }, { status: 500 });
  }
}
