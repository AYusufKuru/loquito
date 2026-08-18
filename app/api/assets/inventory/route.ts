import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  createAsset,
  listAssets,
  serializeAsset,
} from "@/lib/assets/service";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function GET() {
  const auth = await requireApiPermission("assets", "view");
  if (auth.error) return auth.error;

  const assets = await listAssets(prisma);
  const totalValueCents = assets.reduce(
    (sum, a) => sum + a.valueCents * a.quantity,
    0,
  );

  return NextResponse.json({
    assets: assets.map(serializeAsset),
    totalValueCents,
    itemCount: assets.length,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("assets", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    let valueCents = 0;
    if (body.valueCents != null) {
      valueCents = Math.round(Number(body.valueCents) || 0);
    } else if (typeof body.value === "string") {
      const parsed = parseBrlToCents(body.value);
      if (parsed == null) throw new Error("Geçersiz değer.");
      valueCents = parsed;
    }

    const asset = await createAsset(
      prisma,
      {
        name: typeof body.name === "string" ? body.name : "",
        category: typeof body.category === "string" ? body.category : null,
        quantity:
          body.quantity != null ? Math.round(Number(body.quantity) || 0) : 1,
        valueCents,
        location: typeof body.location === "string" ? body.location : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      auth.session.userId,
    );

    return NextResponse.json({ asset: serializeAsset(asset) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Demirbaş oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
