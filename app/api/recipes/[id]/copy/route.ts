import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { scrapFromItems, toRecipeDetail } from "@/lib/recipes/serialize";
import type { RawItemInput } from "@/lib/recipes/validation";

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

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "create");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const source = await loadRecipe(id);
    if (!source) {
      return NextResponse.json({ error: "Kaynak reçete bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const code =
      typeof body.code === "string"
        ? body.code.trim().toUpperCase()
        : `${source.code}-V${source.version + 1}`;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : `${source.name} (kopya)`;

    const replaceFruitMaterialId =
      typeof body.replaceFruitMaterialId === "string" && body.replaceFruitMaterialId
        ? body.replaceFruitMaterialId
        : null;

    const customerId =
      body.customerId !== undefined
        ? typeof body.customerId === "string" && body.customerId
          ? body.customerId
          : null
        : source.customerId;

    const duplicate = await prisma.recipe.findUnique({ where: { code } });
    if (duplicate) {
      return NextResponse.json({ error: "Bu reçete kodu zaten kullanılıyor." }, { status: 400 });
    }

    let replaceMat: { unit: string; category: string } | null = null;
    if (replaceFruitMaterialId) {
      replaceMat = await prisma.material.findUnique({
        where: { id: replaceFruitMaterialId },
        select: { unit: true, category: true },
      });
      if (!replaceMat || replaceMat.category !== "raw") {
        return NextResponse.json({ error: "Geçersiz meyve malzemesi." }, { status: 400 });
      }
    }

    const rawItems: RawItemInput[] = [];

    for (const item of source.items.filter((i) => i.itemType === "raw")) {
      if (!item.materialId) continue;

      const isFruit =
        item.material?.subcategory === "fruit" ||
        item.material?.code.startsWith("MEYVE_");

      if (isFruit && replaceFruitMaterialId && replaceMat) {
        rawItems.push({
          materialId: replaceFruitMaterialId,
          quantity: item.quantity,
          unit: replaceMat.unit,
          notes: item.notes,
        });
      } else {
        rawItems.push({
          materialId: item.materialId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        });
      }
    }

    const scrapPercent = scrapFromItems(
      rawItems.map((i) => ({
        id: "",
        materialId: i.materialId,
        materialCode: null,
        materialName: null,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes ?? null,
      })),
      source.yieldKg,
    );

    const recipe = await prisma.recipe.create({
      data: {
        code,
        name,
        flavorId: source.flavorId,
        customerId,
        yieldKg: source.yieldKg,
        scrapPercent,
        version: source.version + 1,
        notes: source.notes,
      },
    });

    await prisma.recipeItem.createMany({
      data: rawItems.map((item) => ({
        recipeId: recipe.id,
        materialId: item.materialId,
        itemType: "raw",
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes,
      })),
    });

    const packagingItems = source.items.filter((i) => i.itemType === "packaging");
    if (packagingItems.length > 0) {
      await prisma.recipeItem.createMany({
        data: packagingItems.map((item) => ({
          recipeId: recipe.id,
          materialId: item.materialId,
          itemType: "packaging",
          packagingId: item.packagingId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });
    }

    const packagings = await prisma.packaging.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const full = await loadRecipe(recipe.id);
    if (!full) {
      return NextResponse.json({ error: "Kopya oluşturulamadı." }, { status: 500 });
    }

    return NextResponse.json({ recipe: toRecipeDetail(full, packagings) });
  } catch {
    return NextResponse.json({ error: "Kopya oluşturulamadı." }, { status: 500 });
  }
}
