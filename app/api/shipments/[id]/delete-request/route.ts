import { NextResponse } from "next/server";

import { requestShipmentDelete } from "@/lib/approvals/service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("shipments", "delete");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = typeof body?.reason === "string" ? body.reason : "";

    const pending = await requestShipmentDelete(prisma, {
      shipmentId: id,
      reason,
      userId: auth.session.userId,
    });

    return NextResponse.json({ pending });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Silme talebi oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
