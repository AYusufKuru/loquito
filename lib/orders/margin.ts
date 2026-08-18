import type { PrismaClient } from "@prisma/client";

import {
  buildCostResult,
  boxesPerBatch,
  computePackagingCostCents,
  computeRawCostCents,
} from "@/lib/recipes/cost";

type Db = PrismaClient;

export async function getProductUnitCostCents(db: Db, productId: string): Promise<number> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      packaging: true,
      recipe: {
        include: {
          items: {
            include: {
              material: {
                select: {
                  unitPriceCents: true,
                  subcategory: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!product?.recipe || !product.packaging) return 0;

  const recipe = product.recipe;
  const packaging = product.packaging;

  const rawItems = recipe.items
    .filter((i) => i.itemType === "raw")
    .map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialCode: null,
      materialName: null,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      subcategory: i.material?.subcategory ?? null,
    }));

  const prices = new Map<string, number>();
  for (const item of recipe.items) {
    if (item.materialId && item.material) {
      prices.set(item.materialId, item.material.unitPriceCents);
    }
  }

  const packagingItems = recipe.items
    .filter((i) => i.itemType === "packaging" && i.packagingId === packaging.id)
    .map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialCode: null,
      materialName: null,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      packagingId: packaging.id,
      subcategory: i.material?.subcategory ?? null,
      unitPriceCents: i.material?.unitPriceCents ?? 0,
      perBatch:
        i.notes === "per_batch" || i.material?.subcategory === "gelatin",
    }));

  const batchBoxes = boxesPerBatch(recipe.yieldKg, packaging.netWeightG);
  const rawCostCents = computeRawCostCents(rawItems, prices);
  const packagingCostCents = computePackagingCostCents(packagingItems, batchBoxes);

  const cost = buildCostResult(
    packaging.id,
    packaging.label,
    packaging.netWeightG,
    packaging.unitsPerBox,
    recipe.yieldKg,
    rawCostCents,
    packagingCostCents,
  );

  return cost.perBoxCents;
}
