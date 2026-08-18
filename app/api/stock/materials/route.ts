import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toMaterialRow } from "@/lib/stock/serialize";
import { parseMaterialInput } from "@/lib/stock/validation";

async function loadFlavorPackagingMaps() {
  const [flavors, packagings] = await Promise.all([
    prisma.flavor.findMany({ select: { id: true, namePt: true } }),
    prisma.packaging.findMany({ select: { id: true, label: true } }),
  ]);
  return {
    flavorMap: Object.fromEntries(flavors.map((f) => [f.id, f.namePt])),
    packagingMap: Object.fromEntries(packagings.map((p) => [p.id, p.label])),
  };
}

export async function GET(request: Request) {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const materials = await prisma.material.findMany({
    where: category ? { category } : undefined,
    include: { supplier: { select: { name: true } } },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  const { flavorMap, packagingMap } = await loadFlavorPackagingMaps();

  return NextResponse.json({
    materials: materials.map((m) =>
      toMaterialRow(
        m,
        m.flavorId ? flavorMap[m.flavorId] : null,
        m.packagingId ? packagingMap[m.packagingId] : null,
      ),
    ),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("stock", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const parsed = parseMaterialInput(body);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;

    const existing = await prisma.material.findUnique({ where: { code: data.code } });
    if (existing) {
      return NextResponse.json({ error: "Bu malzeme kodu zaten kullanılıyor." }, { status: 400 });
    }

    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: "Geçersiz tedarikçi." }, { status: 400 });
      }
    }

    if (data.flavorId) {
      const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
      if (!flavor) {
        return NextResponse.json({ error: "Geçersiz lezzet." }, { status: 400 });
      }
    }

    if (data.packagingId) {
      const packaging = await prisma.packaging.findUnique({ where: { id: data.packagingId } });
      if (!packaging) {
        return NextResponse.json({ error: "Geçersiz gramaj." }, { status: 400 });
      }
    }

    const material = await prisma.material.create({
      data: {
        code: data.code,
        name: data.name,
        category: data.category,
        subcategory: data.subcategory,
        unit: data.unit,
        unitPriceCents: data.unitPriceCents,
        currentQty: data.currentQty,
        criticalLevel: data.criticalLevel,
        flavorId: data.flavorId,
        packagingId: data.packagingId,
        supplierId: data.supplierId,
        isDailySupply: data.isDailySupply,
        isActive: data.isActive,
        notes: data.notes,
      },
      include: { supplier: { select: { name: true } } },
    });

    const { flavorMap, packagingMap } = await loadFlavorPackagingMaps();

    return NextResponse.json({
      material: toMaterialRow(
        material,
        material.flavorId ? flavorMap[material.flavorId] : null,
        material.packagingId ? packagingMap[material.packagingId] : null,
      ),
    });
  } catch {
    return NextResponse.json({ error: "Malzeme oluşturulamadı." }, { status: 500 });
  }
}
