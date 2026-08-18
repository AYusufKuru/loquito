import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { scrapFromItems, toRecipeDetail } from "@/lib/recipes/serialize";
import { parseRecipeInput, type RawItemInput } from "@/lib/recipes/validation";

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

export async function GET() {
  const auth = await requireApiPermission("recipes", "view");
  if (auth.error) return auth.error;

  const recipes = await prisma.recipe.findMany({
    include: {
      flavor: { select: { namePt: true, code: true } },
      customer: { select: { name: true } },
      items: {
        where: { itemType: { in: ["raw", "packaging"] } },
        select: { id: true, itemType: true, packagingId: true },
      },
    },
    orderBy: [{ code: "asc" }],
  });

  return NextResponse.json({
    recipes: recipes.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      flavorId: r.flavorId,
      flavorName: r.flavor?.namePt ?? null,
      flavorCode: r.flavor?.code ?? null,
      customerId: r.customerId,
      customerName: r.customer?.name ?? null,
      yieldKg: r.yieldKg,
      scrapPercent: r.scrapPercent,
      version: r.version,
      isActive: r.isActive,
      notes: r.notes,
      rawItemCount: r.items.filter((i) => i.itemType === "raw").length,
      packagingProfileCount: new Set(
        r.items
          .filter((i) => i.itemType === "packaging" && i.packagingId)
          .map((i) => i.packagingId),
      ).size,
      isCustomerSpecific: Boolean(r.customerId),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("recipes", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const parsed = parseRecipeInput(body);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;

    const existing = await prisma.recipe.findUnique({ where: { code: data.code } });
    if (existing) {
      return NextResponse.json({ error: "Bu reçete kodu zaten kullanılıyor." }, { status: 400 });
    }

    if (data.flavorId) {
      const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
      if (!flavor) return NextResponse.json({ error: "Geçersiz lezzet." }, { status: 400 });
    }

    if (data.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) return NextResponse.json({ error: "Geçersiz müşteri." }, { status: 400 });
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

    const recipe = await prisma.recipe.create({
      data: {
        code: data.code,
        name: data.name,
        flavorId: data.flavorId,
        customerId: data.customerId,
        yieldKg: data.yieldKg,
        scrapPercent,
        notes: data.notes,
      },
    });

    await replaceRawItems(recipe.id, data.rawItems);

    const full = await loadRecipe(recipe.id);
    if (!full) {
      return NextResponse.json({ error: "Reçete oluşturulamadı." }, { status: 500 });
    }

    const packagings = await prisma.packaging.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ recipe: toRecipeDetail(full, packagings) });
  } catch {
    return NextResponse.json({ error: "Reçete oluşturulamadı." }, { status: 500 });
  }
}
