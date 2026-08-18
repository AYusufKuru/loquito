import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toPriceListItemRow, toPriceListRow } from "@/lib/pricing/serialize";

type RouteContext = { params: Promise<{ id: string }> };

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadList(id: string) {
  return prisma.priceList.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { product: { sku: "asc" } },
      },
      customers: { select: { id: true } },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const list = await loadList(id);
  if (!list) {
    return NextResponse.json({ error: "Fiyat listesi bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({
    priceList: toPriceListRow(list),
    items: list.items.map(toPriceListItemRow),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const existing = await prisma.priceList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Fiyat listesi bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const code =
      typeof body.code === "string" && body.code.trim()
        ? body.code.trim().toUpperCase()
        : existing.code;

    if (code !== existing.code) {
      const dup = await prisma.priceList.findUnique({ where: { code } });
      if (dup) {
        return NextResponse.json({ error: "Bu liste kodu zaten kullanılıyor." }, { status: 400 });
      }
    }

    await prisma.priceList.update({
      where: { id },
      data: {
        code,
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim()
            : existing.name,
        channel:
          typeof body.channel === "string" ? body.channel.trim() || null : existing.channel,
        region:
          typeof body.region === "string" ? body.region.trim() || null : existing.region,
        validFrom:
          body.validFrom !== undefined ? parseDate(body.validFrom) : existing.validFrom,
        validTo: body.validTo !== undefined ? parseDate(body.validTo) : existing.validTo,
        isActive:
          typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      },
    });

    const full = await loadList(id);
    if (!full) {
      return NextResponse.json({ error: "Liste güncellenemedi." }, { status: 500 });
    }

    return NextResponse.json({
      priceList: toPriceListRow(full),
      items: full.items.map(toPriceListItemRow),
    });
  } catch {
    return NextResponse.json({ error: "Liste güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const customerCount = await prisma.customer.count({ where: { priceListId: id } });
  if (customerCount > 0) {
    await prisma.priceList.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await prisma.priceList.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
