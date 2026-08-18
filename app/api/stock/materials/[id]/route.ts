import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toMaterialRow } from "@/lib/stock/serialize";
import { parseMaterialInput } from "@/lib/stock/validation";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Malzeme bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const merged = {
      code: typeof body.code === "string" ? body.code : existing.code,
      name: typeof body.name === "string" ? body.name : existing.name,
      category: typeof body.category === "string" ? body.category : existing.category,
      subcategory:
        body.subcategory !== undefined ? body.subcategory : existing.subcategory,
      unit: typeof body.unit === "string" ? body.unit : existing.unit,
      unitPriceCents:
        typeof body.unitPriceCents === "number" ? body.unitPriceCents : existing.unitPriceCents,
      currentQty:
        typeof body.currentQty === "number" ? body.currentQty : existing.currentQty,
      criticalLevel:
        typeof body.criticalLevel === "number" ? body.criticalLevel : existing.criticalLevel,
      flavorId: body.flavorId !== undefined ? body.flavorId : existing.flavorId,
      packagingId: body.packagingId !== undefined ? body.packagingId : existing.packagingId,
      supplierId: body.supplierId !== undefined ? body.supplierId : existing.supplierId,
      isDailySupply:
        typeof body.isDailySupply === "boolean"
          ? body.isDailySupply
          : existing.isDailySupply,
      isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    };
    const parsed = parseMaterialInput(merged);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;

    if (data.code !== existing.code) {
      const duplicate = await prisma.material.findUnique({ where: { code: data.code } });
      if (duplicate) {
        return NextResponse.json({ error: "Bu malzeme kodu zaten kullanılıyor." }, { status: 400 });
      }
    }

    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: "Geçersiz tedarikçi." }, { status: 400 });
      }
    }

    const material = await prisma.material.update({
      where: { id },
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
    return NextResponse.json({ error: "Malzeme güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("stock", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Malzeme bulunamadı." }, { status: 404 });
  }

  const usage = await prisma.recipeItem.count({ where: { materialId: id } });
  if (usage > 0) {
    await prisma.material.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await prisma.material.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
