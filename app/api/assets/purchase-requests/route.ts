import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  createPurchaseRequest,
  getPurchaseSummary,
  listPurchaseRequests,
  serializePurchaseRequest,
} from "@/lib/assets/service";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function GET(request: Request) {
  const auth = await requireApiPermission("assets", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const [requests, summary] = await Promise.all([
    listPurchaseRequests(prisma, { status }),
    getPurchaseSummary(prisma),
  ]);

  return NextResponse.json({
    requests: requests.map(serializePurchaseRequest),
    summary,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("assets", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    let unitPriceCents = 0;
    if (body.unitPriceCents != null) {
      unitPriceCents = Math.round(Number(body.unitPriceCents) || 0);
    } else if (typeof body.unitPrice === "string") {
      const parsed = parseBrlToCents(body.unitPrice);
      if (parsed == null) throw new Error("Geçersiz birim fiyat.");
      unitPriceCents = parsed;
    }

    let totalCents: number | undefined;
    if (body.totalCents != null) {
      totalCents = Math.round(Number(body.totalCents) || 0);
    } else if (typeof body.total === "string") {
      const parsed = parseBrlToCents(body.total);
      if (parsed == null) throw new Error("Geçersiz toplam tutar.");
      totalCents = parsed;
    }

    const requestRow = await createPurchaseRequest(
      prisma,
      {
        requestType: typeof body.requestType === "string" ? body.requestType : "",
        itemName: typeof body.itemName === "string" ? body.itemName : "",
        description:
          typeof body.description === "string" ? body.description : null,
        usageArea: typeof body.usageArea === "string" ? body.usageArea : null,
        quantity:
          body.quantity != null ? Number(body.quantity) || 1 : 1,
        unit: typeof body.unit === "string" ? body.unit : null,
        priority: typeof body.priority === "string" ? body.priority : null,
        supplierId:
          typeof body.supplierId === "string" ? body.supplierId : null,
        unitPriceCents,
        totalCents,
        deliveryDays:
          body.deliveryDays != null
            ? Math.round(Number(body.deliveryDays) || 0)
            : null,
        warranty: typeof body.warranty === "string" ? body.warranty : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
      auth.session.userId,
    );

    return NextResponse.json({
      request: serializePurchaseRequest(requestRow),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Talep oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
