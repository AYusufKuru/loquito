import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toPriceListRow } from "@/lib/pricing/serialize";

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const lists = await prisma.priceList.findMany({
    include: {
      items: { select: { id: true } },
      customers: { select: { id: true } },
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ priceLists: lists.map(toPriceListRow) });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!code || !name) {
      return NextResponse.json({ error: "Kod ve ad zorunludur." }, { status: 400 });
    }

    const existing = await prisma.priceList.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "Bu liste kodu zaten kullanılıyor." }, { status: 400 });
    }

    const list = await prisma.priceList.create({
      data: {
        code,
        name,
        channel:
          typeof body.channel === "string" && body.channel.trim()
            ? body.channel.trim()
            : null,
        region:
          typeof body.region === "string" && body.region.trim()
            ? body.region.trim()
            : null,
        validFrom: parseDate(body.validFrom),
        validTo: parseDate(body.validTo),
        isActive: body.isActive !== false,
      },
      include: {
        items: { select: { id: true } },
        customers: { select: { id: true } },
      },
    });

    return NextResponse.json({ priceList: toPriceListRow(list) });
  } catch {
    return NextResponse.json({ error: "Fiyat listesi oluşturulamadı." }, { status: 500 });
  }
}
