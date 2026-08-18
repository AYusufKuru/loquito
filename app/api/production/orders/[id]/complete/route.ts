import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  assignProductionLine,
  completeProductionOrder,
} from "@/lib/production/complete-order";
import { serializeProductionOrder } from "@/lib/production/serialize";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("production", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const body = await request.json();

    if (body.action === "assign_line") {
      const lineId = typeof body.lineId === "string" ? body.lineId : "";
      if (!lineId) {
        return NextResponse.json({ error: "Kazan/hat seçin." }, { status: 400 });
      }
      const order = await assignProductionLine(prisma, id, lineId);
      return NextResponse.json({ order: serializeProductionOrder(order) });
    }

    const producedUnits = Number(body.producedUnits);
    const scrapKg = body.scrapKg != null ? Number(body.scrapKg) : 0;
    const scrapReason =
      typeof body.scrapReason === "string" ? body.scrapReason : null;
    const consumptions = Array.isArray(body.consumptions)
      ? body.consumptions.map((c: Record<string, unknown>) => ({
          consumptionId: String(c.consumptionId ?? ""),
          actualQty: Number(c.actualQty),
          lotId:
            typeof c.lotId === "string" && c.lotId ? c.lotId : null,
        }))
      : [];

    const order = await completeProductionOrder(prisma, id, {
      producedUnits,
      scrapKg,
      scrapReason,
      consumptions,
    });

    return NextResponse.json({ order: serializeProductionOrder(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Üretim kapatılamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
