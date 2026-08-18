import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { receivePurchaseOrder } from "@/lib/stock/purchase-order-service";
import { toPurchaseOrderRow } from "@/lib/stock/purchase-order-serialize";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];

    type ReceiveInput = {
      itemId: string;
      quantity?: unknown;
      supplierLotNo?: string | null;
      expiryDate?: string | null;
    };
    const lines = rawLines
      .filter((l: unknown): l is ReceiveInput =>
        !!l &&
        typeof l === "object" &&
        typeof (l as ReceiveInput).itemId === "string",
      )
      .map((l: ReceiveInput) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        supplierLotNo:
          typeof l.supplierLotNo === "string" ? l.supplierLotNo : null,
        expiryDate: typeof l.expiryDate === "string" ? l.expiryDate : null,
      }))
      .filter(
        (l: { itemId: string; quantity: number }) =>
          l.itemId && Number.isFinite(l.quantity) && l.quantity > 0,
      );

    const order = await receivePurchaseOrder(id, lines);
    return NextResponse.json({ order: toPurchaseOrderRow(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Teslim alma kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
