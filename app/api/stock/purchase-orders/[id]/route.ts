import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatus,
} from "@/lib/stock/purchase-order-constants";
import {
  getPurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/lib/stock/purchase-order-service";
import { toPurchaseOrderRow } from "@/lib/stock/purchase-order-serialize";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const order = await getPurchaseOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ order: toPurchaseOrderRow(order) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = typeof body.status === "string" ? body.status : "";

    if (!PURCHASE_ORDER_STATUSES.includes(status as PurchaseOrderStatus)) {
      return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    }

    const order = await updatePurchaseOrderStatus(id, status as PurchaseOrderStatus);
    return NextResponse.json({ order: toPurchaseOrderRow(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sipariş güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
