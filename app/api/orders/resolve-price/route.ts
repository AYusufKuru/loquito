import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { priceSourceLabel, resolvePrice } from "@/lib/pricing/resolve";
import type { QuantityUnit } from "@/lib/pricing/types";

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const quantity =
      typeof body.quantity === "number" ? body.quantity : Number(body.quantity);
    const quantityUnit: QuantityUnit =
      body.quantityUnit === "unit" ? "unit" : "box";

    if (!customerId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Geçersiz parametreler." }, { status: 400 });
    }

    const resolved = await resolvePrice(
      prisma,
      customerId,
      productId,
      quantity,
      quantityUnit,
    );

    return NextResponse.json({
      price: resolved,
      sourceLabel: priceSourceLabel(resolved.source),
    });
  } catch {
    return NextResponse.json({ error: "Fiyat hesaplanamadı." }, { status: 500 });
  }
}
