import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { deleteTaxLocation, updateTaxLocation } from "@/lib/finance/tax-locations";
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
    const location = await updateTaxLocation(prisma, id, {
      code: typeof body.code === "string" ? body.code : undefined,
      name: body.name !== undefined ? (typeof body.name === "string" ? body.name : null) : undefined,
      taxPercent: body.taxPercent !== undefined ? Number(body.taxPercent) : undefined,
      notes: body.notes !== undefined ? (typeof body.notes === "string" ? body.notes : null) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });
    return NextResponse.json({ location });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Konum güncellenemedi.";
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
    const result = await deleteTaxLocation(prisma, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Konum silinemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
