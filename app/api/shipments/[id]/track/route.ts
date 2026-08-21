import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  CorreiosApiError,
  CorreiosNotConfiguredError,
  isCorreiosConfigured,
} from "@/lib/correios/config";
import { prisma } from "@/lib/prisma";
import { serializeShipment } from "@/lib/shipments/serialize";
import { getShipment } from "@/lib/shipments/service";
import { refreshShipmentTracking, saveShipmentTrackingError } from "@/lib/shipments/tracking";

function errorStatus(error: unknown): { message: string; status: number } {
  if (error instanceof CorreiosNotConfiguredError) {
    return { message: error.message, status: 503 };
  }
  if (error instanceof CorreiosApiError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return { message: "Correios yanıt vermedi (zaman aşımı).", status: 504 };
  }
  const message = error instanceof Error ? error.message : "Kargo durumu alınamadı.";
  return { message, status: 400 };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("shipments", "view");
  if (auth.error) return auth.error;

  const { id } = await params;
  const shipment = await getShipment(prisma, id);
  if (!shipment) {
    return NextResponse.json({ error: "Sevkiyat bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({
    configured: isCorreiosConfigured(),
    shipment: serializeShipment(shipment),
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("shipments", "view");
  if (auth.error) return auth.error;

  const { id } = await params;
  const exists = await prisma.shipment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Sevkiyat bulunamadı." }, { status: 404 });
  }

  try {
    const shipment = await refreshShipmentTracking(prisma, id);
    if (!shipment) {
      return NextResponse.json({ error: "Sevkiyat bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({
      configured: true,
      shipment: serializeShipment(shipment),
    });
  } catch (error) {
    const { message, status } = errorStatus(error);
    try {
      const failed = await saveShipmentTrackingError(prisma, id, message);
      return NextResponse.json(
        {
          error: message,
          configured: isCorreiosConfigured(),
          shipment: serializeShipment(failed),
        },
        { status },
      );
    } catch {
      return NextResponse.json(
        { error: message, configured: isCorreiosConfigured() },
        { status },
      );
    }
  }
}
