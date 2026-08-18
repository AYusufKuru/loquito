import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { updateFinishedStock } from "@/lib/finished-stock/service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await request.json();

  try {
    const row = await updateFinishedStock(prisma, id, {
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      expiryDate:
        body.expiryDate === null || typeof body.expiryDate === "string"
          ? body.expiryDate
          : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      lotNo:
        body.lotNo === null || typeof body.lotNo === "string" ? body.lotNo : undefined,
    });

    return NextResponse.json({ row });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Güncelleme başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
