import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  buildCostResult,
  computePackagingCostCents,
  computeRawCostCents,
  boxesPerBatch,
} from "@/lib/recipes/cost";
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

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const packagingId = searchParams.get("packagingId");

  const recipe = await loadRecipe(id);
  if (!recipe) {
    return NextResponse.json({ error: "Reçete bulunamadı." }, { status: 404 });
  }

  if (packagingId) {
    const packaging = await prisma.packaging.findUnique({ where: { id: packagingId } });
    if (!packaging) {
      return NextResponse.json({ error: "Geçersiz gramaj." }, { status: 400 });
    }

    const rawItems = recipe.items
      .filter((i) => i.itemType === "raw")
      .map((i) => ({
        id: i.id,
        materialId: i.materialId,
        materialCode: i.material?.code ?? null,
        materialName: i.material?.name ?? null,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
        subcategory: i.material?.subcategory ?? null,
      }));

    const prices = new Map(
      recipe.items
        .filter((i) => i.materialId && i.material)
        .map((i) => [i.materialId!, i.material!.unitPriceCents]),
    );

    const packagingItems = recipe.items
      .filter((i) => i.itemType === "packaging" && i.packagingId === packagingId)
      .map((i) => ({
        id: i.id,
        materialId: i.materialId,
        materialCode: i.material?.code ?? null,
        materialName: i.material?.name ?? null,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
        packagingId,
        subcategory: i.material?.subcategory ?? null,
        unitPriceCents: i.material?.unitPriceCents ?? 0,
        perBatch:
          i.notes === "per_batch" || i.material?.subcategory === "gelatin",
      }));

    const batchBoxes = boxesPerBatch(recipe.yieldKg, packaging.netWeightG);
    const rawCostCents = computeRawCostCents(rawItems, prices);
    const packagingCostCents = computePackagingCostCents(
      packagingItems,
      batchBoxes,
    );

    const cost = buildCostResult(
      packagingId,
      packaging.label,
      packaging.netWeightG,
      packaging.unitsPerBox,
      recipe.yieldKg,
      rawCostCents,
      packagingCostCents,
    );

    return NextResponse.json({ cost });
  }

  const packagings = await prisma.packaging.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    recipe: toRecipeDetail(recipe, packagings),
  });
}
