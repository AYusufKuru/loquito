import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  deleteAsset,
  serializeAsset,
  updateAsset,
} from "@/lib/assets/service";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("assets", "edit");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const updates: {
      name?: string;
      category?: string | null;
      quantity?: number;
      valueCents?: number;
      location?: string | null;
      notes?: string | null;
      isActive?: boolean;
    } = {};

    if (typeof body.name === "string") updates.name = body.name;
    if (body.category !== undefined) {
      updates.category = typeof body.category === "string" ? body.category : null;
    }
    if (body.quantity != null) {
      updates.quantity = Math.round(Number(body.quantity) || 0);
    }
    if (body.valueCents != null) {
      updates.valueCents = Math.round(Number(body.valueCents) || 0);
    } else if (typeof body.value === "string") {
      const parsed = parseBrlToCents(body.value);
      if (parsed == null) throw new Error("Geçersiz değer.");
      updates.valueCents = parsed;
    }
    if (body.location !== undefined) {
      updates.location = typeof body.location === "string" ? body.location : null;
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes : null;
    }
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    const asset = await updateAsset(
      prisma,
      id,
      updates,
      auth.session.userId,
    );

    return NextResponse.json({ asset: serializeAsset(asset) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Demirbaş güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("assets", "delete");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    await deleteAsset(prisma, id, auth.session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Demirbaş silinemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
