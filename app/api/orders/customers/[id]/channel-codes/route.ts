import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toChannelCodeRow } from "@/lib/pricing/serialize";

type RouteContext = { params: Promise<{ id: string }> };

const CHANNELS = new Set(["retail", "corporate", "portal"]);

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const { id: customerId } = await context.params;

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const items = body.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Geçersiz kod listesi." }, { status: 400 });
    }

    await prisma.productChannelCode.deleteMany({ where: { customerId } });

    for (const row of items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === "string" ? r.productId : "";
      const externalSku =
        typeof r.externalSku === "string" ? r.externalSku.trim().toUpperCase() : "";
      const channel = typeof r.channel === "string" ? r.channel : "corporate";

      if (!productId || !externalSku || !CHANNELS.has(channel)) continue;

      await prisma.productChannelCode.create({
        data: {
          productId,
          customerId,
          channel,
          externalSku,
        },
      });
    }

    const codes = await prisma.productChannelCode.findMany({
      where: { customerId },
      include: { product: { select: { sku: true, name: true } } },
      orderBy: { externalSku: "asc" },
    });

    return NextResponse.json({ channelCodes: codes.map(toChannelCodeRow) });
  } catch {
    return NextResponse.json({ error: "Kanal kodları kaydedilemedi." }, { status: 500 });
  }
}
