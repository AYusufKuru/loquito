import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { resolveProductByExternalSku } from "@/lib/pricing/sku-map";

export async function GET(request: Request) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const externalSku = searchParams.get("externalSku") ?? "";
  const customerId = searchParams.get("customerId");
  const channel = searchParams.get("channel");

  if (!externalSku.trim()) {
    return NextResponse.json({ error: "Harici SKU zorunludur." }, { status: 400 });
  }

  const result = await resolveProductByExternalSku(prisma, externalSku, {
    customerId,
    channel,
  });

  if (!result) {
    return NextResponse.json({ error: "SKU eşlemesi bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ resolution: result });
}
