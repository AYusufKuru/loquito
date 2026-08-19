import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  CHECKLIST_FIELDS,
  SHIPMENT_STATUSES,
  type ChecklistField,
  type ShipmentStatus,
} from "@/lib/shipments/constants";
import { serializeShipment } from "@/lib/shipments/serialize";
import { getShipment, updateShipment, deleteShipment } from "@/lib/shipments/service";

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

  return NextResponse.json({ shipment: serializeShipment(shipment) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("shipments", "edit");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    const checklist: Partial<Record<ChecklistField, boolean>> = {};
    for (const field of CHECKLIST_FIELDS) {
      if (body[field] !== undefined) {
        checklist[field] = Boolean(body[field]);
      }
    }

    let status: ShipmentStatus | undefined;
    if (typeof body.status === "string" && SHIPMENT_STATUSES.includes(body.status as ShipmentStatus)) {
      status = body.status as ShipmentStatus;
    }

    const shipment = await updateShipment(prisma, id, {
      status,
      plannedShipDate:
        body.plannedShipDate !== undefined
          ? typeof body.plannedShipDate === "string"
            ? body.plannedShipDate
            : null
          : undefined,
      plannedDelivery:
        body.plannedDelivery !== undefined
          ? typeof body.plannedDelivery === "string"
            ? body.plannedDelivery
            : null
          : undefined,
      carrierName: body.carrierName !== undefined ? String(body.carrierName ?? "") : undefined,
      driverName: body.driverName !== undefined ? String(body.driverName ?? "") : undefined,
      vehiclePlate:
        body.vehiclePlate !== undefined ? String(body.vehiclePlate ?? "") : undefined,
      trackingNo: body.trackingNo !== undefined ? String(body.trackingNo ?? "") : undefined,
      palletCount:
        body.palletCount !== undefined ? Math.max(0, Math.floor(Number(body.palletCount) || 0)) : undefined,
      sealNo: body.sealNo !== undefined ? String(body.sealNo ?? "") : undefined,
      receivedBy: body.receivedBy !== undefined ? String(body.receivedBy ?? "") : undefined,
      proofNo: body.proofNo !== undefined ? String(body.proofNo ?? "") : undefined,
      notes: body.notes !== undefined ? String(body.notes ?? "") : undefined,
      issueShortageUnits:
        body.issueShortageUnits !== undefined
          ? Math.max(0, Math.floor(Number(body.issueShortageUnits) || 0))
          : undefined,
      issueDamageUnits:
        body.issueDamageUnits !== undefined
          ? Math.max(0, Math.floor(Number(body.issueDamageUnits) || 0))
          : undefined,
      issueReturnUnits:
        body.issueReturnUnits !== undefined
          ? Math.max(0, Math.floor(Number(body.issueReturnUnits) || 0))
          : undefined,
      issueNotes: body.issueNotes !== undefined ? String(body.issueNotes ?? "") : undefined,
      checklist: Object.keys(checklist).length > 0 ? checklist : undefined,
    });

    return NextResponse.json({ shipment: serializeShipment(shipment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Güncelleme başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("shipments", "delete");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    await deleteShipment(prisma, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sevkiyat silinemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
