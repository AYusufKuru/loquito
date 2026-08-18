import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  createPurchaseOrder,
  listPurchaseOrders,
} from "@/lib/stock/purchase-order-service";
import { toPurchaseOrderRow } from "@/lib/stock/purchase-order-serialize";

export async function GET(request: Request) {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const orders = await listPurchaseOrders(status);
    return NextResponse.json({
      orders: orders.map(toPurchaseOrderRow),
    });
  } catch (error) {
    console.error("[purchase-orders GET]", error);
    const message =
      error instanceof Error ? error.message : "Satın alma siparişleri yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("stock", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const supplierId = typeof body.supplierId === "string" ? body.supplierId : "";
    const deliveryDate =
      typeof body.deliveryDate === "string" && body.deliveryDate
        ? body.deliveryDate
        : null;
    const notes = typeof body.notes === "string" ? body.notes : null;
    const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];

    type LineInput = { materialId: string; quantity?: unknown; unitPriceCents?: unknown };
    const lines = rawLines
      .filter((l: unknown): l is LineInput =>
        !!l &&
        typeof l === "object" &&
        typeof (l as LineInput).materialId === "string",
      )
      .map((l: LineInput) => ({
        materialId: l.materialId,
        quantity: Number(l.quantity),
        unitPriceCents: Number(l.unitPriceCents) || 0,
        notes: null,
      }))
      .filter(
        (l: { materialId: string; quantity: number }) =>
          l.materialId && Number.isFinite(l.quantity) && l.quantity > 0,
      );

    if (!supplierId) {
      return NextResponse.json({ error: "Tedarikçi seçimi zorunludur." }, { status: 400 });
    }
    if (lines.length === 0) {
      return NextResponse.json({ error: "En az bir satır gerekli." }, { status: 400 });
    }

    const order = await createPurchaseOrder({
      supplierId,
      deliveryDate,
      notes,
      lines,
    });

    return NextResponse.json({ order: toPurchaseOrderRow(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Satın alma siparişi oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
