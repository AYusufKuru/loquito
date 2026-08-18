import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { applyStockMovement, parseMovementInput } from "@/lib/stock/movement-service";

export async function GET(request: Request) {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get("materialId");

  const movements = await prisma.stockMovement.findMany({
    where: materialId ? { materialId } : undefined,
    include: {
      material: { select: { code: true, name: true, unit: true } },
      lot: { select: { internalLotNo: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    movements: movements.map((m) => ({
      id: m.id,
      materialId: m.materialId,
      materialCode: m.material.code,
      materialName: m.material.name,
      materialUnit: m.material.unit,
      lotId: m.lotId,
      internalLotNo: m.lot?.internalLotNo ?? null,
      type: m.type,
      quantity: m.quantity,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("stock", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const parsed = parseMovementInput(body);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await applyStockMovement(parsed.data);

    return NextResponse.json({
      movement: {
        id: result.movement.id,
        materialId: result.movement.materialId,
        lotId: result.movement.lotId,
        type: result.movement.type,
        quantity: result.movement.quantity,
        notes: result.movement.notes,
        createdAt: result.movement.createdAt.toISOString(),
      },
      material: result.material
        ? {
            id: result.material.id,
            currentQty: result.material.currentQty,
          }
        : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Hareket kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
