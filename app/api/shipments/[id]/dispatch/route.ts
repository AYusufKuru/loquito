import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { serializeShipment } from "@/lib/shipments/serialize";
import { dispatchShipment } from "@/lib/shipments/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("shipments", "edit");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const shipment = await dispatchShipment(prisma, id);
    if (!shipment) {
      return NextResponse.json({ error: "Sevkiyat bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({ shipment: serializeShipment(shipment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sevk başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
