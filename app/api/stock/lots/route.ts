import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { getAvailableQty } from "@/lib/stock/inventory";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get("materialId");
  const status = searchParams.get("status");

  const lots = await prisma.materialLot.findMany({
    where: {
      materialId: materialId ?? undefined,
      status: status ?? undefined,
      quantity: { gt: 0 },
    },
    include: {
      material: { select: { code: true, name: true, unit: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  const availableQty = materialId
    ? await getAvailableQty(prisma, materialId)
    : undefined;

  return NextResponse.json({
    availableQty,
    lots: lots.map((lot) => ({
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
    })),
  });
}
