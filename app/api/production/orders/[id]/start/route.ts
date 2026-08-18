import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { startProductionOrder } from "@/lib/production/complete-order";
import { serializeProductionOrder } from "@/lib/production/serialize";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("production", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const lineId = typeof body.lineId === "string" ? body.lineId : undefined;

    const order = await startProductionOrder(prisma, id, lineId);
    return NextResponse.json({ order: serializeProductionOrder(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Üretim başlatılamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
