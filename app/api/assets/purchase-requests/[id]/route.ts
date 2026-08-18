import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  advancePurchaseStatus,
  serializePurchaseRequest,
  updatePurchaseRequest,
} from "@/lib/assets/service";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("assets", "edit");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();

    if (body.advanceStatus) {
      const requestRow = await advancePurchaseStatus(
        prisma,
        id,
        auth.session.userId,
        {
          orderNo: typeof body.orderNo === "string" ? body.orderNo : undefined,
          approvedBy: auth.session.userId,
        },
      );
      return NextResponse.json({
        request: serializePurchaseRequest(requestRow),
      });
    }

    let unitPriceCents: number | undefined;
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

    const requestRow = await updatePurchaseRequest(
      prisma,
      id,
      {
        requestType:
          typeof body.requestType === "string" ? body.requestType : undefined,
        itemName:
          typeof body.itemName === "string" ? body.itemName : undefined,
        description:
          body.description !== undefined
            ? typeof body.description === "string"
              ? body.description
              : null
            : undefined,
        usageArea:
          body.usageArea !== undefined
            ? typeof body.usageArea === "string"
              ? body.usageArea
              : null
            : undefined,
        quantity: body.quantity != null ? Number(body.quantity) : undefined,
        unit:
          body.unit !== undefined
            ? typeof body.unit === "string"
              ? body.unit
              : null
            : undefined,
        priority:
          body.priority !== undefined
            ? typeof body.priority === "string"
              ? body.priority
              : null
            : undefined,
        supplierId:
          body.supplierId !== undefined
            ? typeof body.supplierId === "string"
              ? body.supplierId
              : null
            : undefined,
        unitPriceCents,
        totalCents,
        deliveryDays:
          body.deliveryDays !== undefined
            ? body.deliveryDays != null
              ? Math.round(Number(body.deliveryDays) || 0)
              : null
            : undefined,
        warranty:
          body.warranty !== undefined
            ? typeof body.warranty === "string"
              ? body.warranty
              : null
            : undefined,
        notes:
          body.notes !== undefined
            ? typeof body.notes === "string"
              ? body.notes
              : null
            : undefined,
      },
      auth.session.userId,
    );

    return NextResponse.json({
      request: serializePurchaseRequest(requestRow),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Talep güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
