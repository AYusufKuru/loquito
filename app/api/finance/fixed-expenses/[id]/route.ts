import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  deleteFixedExpense,
  serializeFixedExpense,
  updateFixedExpense,
} from "@/lib/finance/service";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("finance", "edit");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const updates: {
      name?: string;
      amountCents?: number;
      category?: string | null;
      notes?: string | null;
      isActive?: boolean;
    } = {};

    if (typeof body.name === "string") updates.name = body.name;
    if (body.amountCents != null) {
      updates.amountCents = Math.round(Number(body.amountCents) || 0);
    } else if (typeof body.amount === "string") {
      const parsed = parseBrlToCents(body.amount);
      if (parsed == null) throw new Error("Geçersiz tutar.");
      updates.amountCents = parsed;
    }
    if (body.category !== undefined) {
      updates.category = typeof body.category === "string" ? body.category : null;
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes : null;
    }
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    const expense = await updateFixedExpense(
      prisma,
      id,
      updates,
      auth.session.userId,
    );

    return NextResponse.json({ expense: serializeFixedExpense(expense) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gider güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("finance", "delete");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    await deleteFixedExpense(prisma, id, auth.session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gider silinemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
