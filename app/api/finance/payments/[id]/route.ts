import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { serializePayment, updatePayment } from "@/lib/finance/payments";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("finance", "edit");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const payment = await updatePayment(
      prisma,
      id,
      {
        status: typeof body.status === "string" ? body.status : undefined,
        paidAt:
          body.markPaid
            ? new Date().toISOString()
            : body.paidAt !== undefined
              ? (body.paidAt as string | null)
              : undefined,
        dueDate:
          body.dueDate !== undefined
            ? (body.dueDate as string | null)
            : undefined,
        method: typeof body.method === "string" ? body.method : undefined,
        reference: typeof body.reference === "string" ? body.reference : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        isApproved: body.isApproved !== undefined ? Boolean(body.isApproved) : undefined,
      },
      auth.session.userId,
    );

    return NextResponse.json({ payment: serializePayment(payment) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ödeme güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
