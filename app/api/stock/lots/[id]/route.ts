import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { LOT_STATUSES, type LotStatus } from "@/lib/stock/lot-constants";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const existing = await prisma.materialLot.findUnique({
      where: { id },
      include: { material: { select: { code: true, name: true, unit: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lot bulunamadı." }, { status: 404 });
    }

    const data: {
      status?: LotStatus;
      notes?: string | null;
      expiryDate?: Date | null;
      supplierLotNo?: string | null;
    } = {};

    if (typeof body.status === "string" && LOT_STATUSES.includes(body.status as LotStatus)) {
      data.status = body.status as LotStatus;
    }

    if (body.notes !== undefined) {
      data.notes =
        typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }

    if (body.expiryDate !== undefined) {
      data.expiryDate =
        typeof body.expiryDate === "string" && body.expiryDate
          ? new Date(body.expiryDate)
          : null;
    }

    if (body.supplierLotNo !== undefined) {
      data.supplierLotNo =
        typeof body.supplierLotNo === "string" && body.supplierLotNo.trim()
          ? body.supplierLotNo.trim()
          : null;
    }

    const lot = await prisma.materialLot.update({
      where: { id },
      data,
      include: { material: { select: { code: true, name: true, unit: true } } },
    });

    return NextResponse.json({
      lot: {
        id: lot.id,
        materialId: lot.materialId,
        materialCode: lot.material.code,
        materialName: lot.material.name,
        materialUnit: lot.material.unit,
        internalLotNo: lot.internalLotNo,
        supplierLotNo: lot.supplierLotNo,
        quantity: lot.quantity,
        expiryDate: lot.expiryDate?.toISOString() ?? null,
        status: lot.status,
        receivedAt: lot.receivedAt.toISOString(),
        notes: lot.notes,
        isUsable: lot.status === "released",
      },
    });
  } catch {
    return NextResponse.json({ error: "Lot güncellenemedi." }, { status: 500 });
  }
}
