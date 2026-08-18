import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { endLineDowntime, startLineDowntime } from "@/lib/production/track";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("production", "edit");
  if (auth.error) return auth.error;

  const { id: lineId } = await context.params;
  const body = await request.json();

  try {
    if (body.action === "end") {
      const line = await endLineDowntime(prisma, lineId);
      return NextResponse.json({ line });
    }

    const reason = typeof body.reason === "string" ? body.reason : "";
    const line = await startLineDowntime(
      prisma,
      lineId,
      reason,
      typeof body.productionOrderId === "string" ? body.productionOrderId : null,
      typeof body.notes === "string" ? body.notes : null,
    );

    return NextResponse.json({ line });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Duruş kaydı başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
