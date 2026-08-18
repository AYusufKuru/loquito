import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { parsePackagingItems } from "@/lib/recipes/packaging";
import { toRecipeDetail } from "@/lib/recipes/serialize";

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

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe) {
      return NextResponse.json({ error: "Reçete bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const packagingId =
      typeof body.packagingId === "string" ? body.packagingId : "";
    if (!packagingId) {
      return NextResponse.json({ error: "Gramaj seçimi zorunludur." }, { status: 400 });
    }

    const packaging = await prisma.packaging.findUnique({ where: { id: packagingId } });
    if (!packaging) {
      return NextResponse.json({ error: "Geçersiz gramaj." }, { status: 400 });
    }

    const items = parsePackagingItems(body.items);
    if (!items) {
      return NextResponse.json({ error: "Geçersiz ambalaj satırları." }, { status: 400 });
    }

    await prisma.recipeItem.deleteMany({
      where: { recipeId: id, itemType: "packaging", packagingId },
    });

    if (items.length > 0) {
      await prisma.recipeItem.createMany({
        data: items.map((item) => ({
          recipeId: id,
          materialId: item.materialId,
          itemType: "packaging",
          packagingId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });
    }

    await prisma.recipe.update({
      where: { id },
      data: { version: recipe.version + 1 },
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
    return NextResponse.json({ error: "Ambalaj kaydedilemedi." }, { status: 500 });
  }
}
