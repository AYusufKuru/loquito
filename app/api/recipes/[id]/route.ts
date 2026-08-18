import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { diffFields, recordAudit } from "@/lib/audit/service";
import { prisma } from "@/lib/prisma";
import { scrapFromItems, toRecipeDetail } from "@/lib/recipes/serialize";
import { parseRecipeInput, type RawItemInput } from "@/lib/recipes/validation";

type RouteContext = { params: Promise<{ id: string }> };

async function loadRecipe(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: {
      flavor: { select: { namePt: true, code: true } },
      customer: { select: { name: true } },
      items: {
        include: {
          material: {
            select: {
              code: true,
              name: true,
              subcategory: true,
              unitPriceCents: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

async function replaceRawItems(recipeId: string, rawItems: RawItemInput[]) {
  await prisma.recipeItem.deleteMany({
    where: { recipeId, itemType: "raw" },
  });

  await prisma.recipeItem.createMany({
    data: rawItems.map((item) => ({
      recipeId,
      materialId: item.materialId,
      itemType: "raw",
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
    })),
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const recipe = await loadRecipe(id);

  if (!recipe) {
    return NextResponse.json({ error: "Reçete bulunamadı." }, { status: 404 });
  }

  const packagings = await prisma.packaging.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ recipe: toRecipeDetail(recipe, packagings) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Reçete bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = parseRecipeInput({
      ...existing,
      ...body,
      code: body.code ?? existing.code,
      name: body.name ?? existing.name,
      yieldKg: body.yieldKg ?? existing.yieldKg,
    });

    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;

    if (data.code !== existing.code) {
      const duplicate = await prisma.recipe.findUnique({ where: { code: data.code } });
      if (duplicate) {
        return NextResponse.json({ error: "Bu reçete kodu zaten kullanılıyor." }, { status: 400 });
      }
    }

    const scrapPercent = scrapFromItems(
      data.rawItems.map((i) => ({
        id: "",
        materialId: i.materialId,
        materialCode: null,
        materialName: null,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes ?? null,
      })),
      data.yieldKg,
    );

    await prisma.recipe.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        flavorId: data.flavorId,
        customerId: data.customerId,
        yieldKg: data.yieldKg,
        scrapPercent,
        notes: data.notes,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
        version: existing.version + 1,
      },
    });

    await replaceRawItems(id, data.rawItems);

    const recipeChanges = diffFields(
      {
        code: existing.code,
        name: existing.name,
        yieldKg: existing.yieldKg,
        scrapPercent: existing.scrapPercent,
        version: existing.version,
        isActive: existing.isActive,
      },
      {
        code: data.code,
        name: data.name,
        yieldKg: data.yieldKg,
        scrapPercent,
        version: existing.version + 1,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      },
      ["code", "name", "yieldKg", "scrapPercent", "version", "isActive"],
    );

    await recordAudit(prisma, {
      userId: auth.session.userId,
      entityType: "recipe",
      entityId: id,
      action: "update",
      changes: recipeChanges,
    });

    const packagings = await prisma.packaging.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const full = await loadRecipe(id);
    if (!full) {
      return NextResponse.json({ error: "Reçete güncellenemedi." }, { status: 500 });
    }

    return NextResponse.json({ recipe: toRecipeDetail(full, packagings) });
  } catch {
    return NextResponse.json({ error: "Reçete güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Reçete bulunamadı." }, { status: 404 });
  }

  const productCount = await prisma.product.count({ where: { recipeId: id } });
  if (productCount > 0) {
    await prisma.recipe.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
