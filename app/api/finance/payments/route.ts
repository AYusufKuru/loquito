import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  listOrderPayments,
  recordPayment,
  serializePayment,
} from "@/lib/finance/payments";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const customerId = searchParams.get("customerId") ?? undefined;

  const orders = await listOrderPayments(prisma, {
    overdueOnly,
    customerId,
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("finance", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    let amountCents = 0;
    if (body.amountCents != null) {
      amountCents = Math.round(Number(body.amountCents) || 0);
    } else if (typeof body.amount === "string") {
      const parsed = parseBrlToCents(body.amount);
      if (parsed == null) throw new Error("Geçersiz tutar.");
      amountCents = parsed;
    }

    const payment = await recordPayment(
      prisma,
      {
        orderId: typeof body.orderId === "string" ? body.orderId : null,
        customerId: typeof body.customerId === "string" ? body.customerId : null,
        amountCents,
        method: typeof body.method === "string" ? body.method : null,
        reference: typeof body.reference === "string" ? body.reference : null,
        paidAt: typeof body.paidAt === "string" ? body.paidAt : null,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        markPaid: Boolean(body.markPaid),
      },
      auth.session.userId,
    );

    return NextResponse.json({ payment: serializePayment(payment) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ödeme kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
