import { NextResponse } from "next/server";

import { getPendingEntityIdSet } from "@/lib/approvals/service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { serializeShipment } from "@/lib/shipments/serialize";
import { createShipment, listShipments, listShippableOrders } from "@/lib/shipments/service";
import type { ShipmentItemInput } from "@/lib/shipments/types";

export async function GET(request: Request) {
  const auth = await requireApiPermission("shipments", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status");
  const view = searchParams.get("view");

  if (view === "orders") {
    const orders = await listShippableOrders(prisma);
    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        customerName: o.customer.name,
        status: o.status,
        deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString().slice(0, 10) : null,
      })),
    });
  }

  const [shipments, pendingIds] = await Promise.all([
    listShipments(prisma, {
      orderId: orderId ?? undefined,
      status: status ?? undefined,
    }),
    getPendingEntityIdSet(prisma, "shipment_delete"),
  ]);

  return NextResponse.json({
    shipments: shipments.map((row) =>
      serializeShipment(row, { pendingDelete: pendingIds.has(row.id) }),
    ),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("shipments", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!orderId) {
      return NextResponse.json({ error: "orderId gerekli." }, { status: 400 });
    }

    const parsedItems: ShipmentItemInput[] = items.map((item: Record<string, unknown>) => ({
      orderItemId: String(item.orderItemId ?? ""),
      boxCount: Math.max(0, Math.floor(Number(item.boxCount) || 0)),
      unitCount: Math.max(0, Math.floor(Number(item.unitCount) || 0)),
      lotNo: typeof item.lotNo === "string" ? item.lotNo : null,
      heldUnitCount: Math.max(0, Math.floor(Number(item.heldUnitCount) || 0)),
      heldLotNo: typeof item.heldLotNo === "string" ? item.heldLotNo : null,
      shortageUnits: Math.max(0, Math.floor(Number(item.shortageUnits) || 0)),
      damageUnits: Math.max(0, Math.floor(Number(item.damageUnits) || 0)),
      returnUnits: Math.max(0, Math.floor(Number(item.returnUnits) || 0)),
    }));

    const shipment = await createShipment(prisma, {
      orderId,
      plannedShipDate: typeof body.plannedShipDate === "string" ? body.plannedShipDate : null,
      plannedDelivery: typeof body.plannedDelivery === "string" ? body.plannedDelivery : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      items: parsedItems,
    });

    return NextResponse.json({ shipment: serializeShipment(shipment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sevkiyat oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
