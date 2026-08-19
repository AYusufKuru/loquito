import type { Prisma, PrismaClient } from "@prisma/client";

import { analyzeOrderProduction } from "@/lib/orders/production-analysis";
import { reserveStockForOrder } from "@/lib/finished-stock/service";

import {
  buildPlannedConsumptions,
  boxesPerBatchForRecipe,
  generateProductionLotNo,
  generateProductionNo,
} from "./consumption-plan";

type Db = PrismaClient | Prisma.TransactionClient;

export interface CreateProductionOrderInput {
  orderId?: string | null;
  productId: string;
  recipeId: string;
  lineId?: string | null;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  notes?: string | null;
}

export async function createProductionOrder(db: Db, input: CreateProductionOrderInput) {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    include: {
      packaging: true,
      recipe: {
        include: {
          items: {
            include: {
              material: {
                select: { id: true, code: true, name: true, unit: true, subcategory: true },
              },
            },
          },
        },
      },
    },
  });

  if (!product?.recipe || !product.packaging) {
    throw new Error("Ürün reçete veya ambalaj bilgisi eksik.");
  }

  if (product.recipeId !== input.recipeId) {
    throw new Error("Reçete ürünle eşleşmiyor.");
  }

  const bpp = boxesPerBatchForRecipe(
    product.recipe.yieldKg,
    product.packaging.netWeightG,
  );
  const plannedConsumptions = buildPlannedConsumptions(
    product.recipe,
    product.packagingId!,
    bpp,
  );

  const count = await db.productionOrder.count();
  const productionNo = generateProductionNo(count + 1);
  const lotNo = generateProductionLotNo(productionNo, 1);

  const order = await db.productionOrder.create({
    data: {
      productionNo,
      lotNo,
      orderId: input.orderId ?? null,
      productId: input.productId,
      recipeId: input.recipeId,
      lineId: input.lineId ?? null,
      status: "planned",
      plannedKg: product.recipe.yieldKg,
      plannedStart: input.plannedStart ?? null,
      plannedEnd: input.plannedEnd ?? null,
      notes: input.notes ?? null,
      consumptions: {
        create: plannedConsumptions.map((c) => ({
          materialId: c.materialId,
          plannedQty: c.plannedQty,
          unit: c.unit,
        })),
      },
    },
    include: productionOrderInclude,
  });

  return order;
}

export async function createProductionOrdersFromOrder(db: PrismaClient, orderId: string) {
  const analysis = await analyzeOrderProduction(db, orderId);
  if (!analysis) throw new Error("Sipariş bulunamadı.");

  const items = await db.orderItem.findMany({
    where: { orderId },
    include: {
      product: {
        include: {
          packaging: true,
          recipe: {
            include: {
              items: {
                include: {
                  material: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      unit: true,
                      subcategory: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return db.$transaction(
    async (tx) => {
      const created: Awaited<ReturnType<typeof createProductionOrder>>[] = [];
      let sequence = await tx.productionOrder.count();

      for (const item of items) {
        const line = analysis.lines.find((l) => l.productId === item.productId);
        if (!line || line.batchesNeeded <= 0) continue;

        const product = item.product;
        if (!product.recipe || !product.packaging) continue;

        const bpp = boxesPerBatchForRecipe(
          product.recipe.yieldKg,
          product.packaging.netWeightG,
        );
        const plannedConsumptions = buildPlannedConsumptions(
          product.recipe,
          product.packagingId!,
          bpp,
        );

        for (let batch = 0; batch < line.batchesNeeded; batch++) {
          sequence += 1;
          const productionNo = generateProductionNo(sequence);
          const lotNo = generateProductionLotNo(productionNo, batch + 1);

          const po = await tx.productionOrder.create({
            data: {
              productionNo,
              lotNo,
              orderId,
              productId: product.id,
              recipeId: product.recipeId!,
              status: "planned",
              plannedKg: product.recipe.yieldKg,
              consumptions: {
                create: plannedConsumptions.map((c) => ({
                  materialId: c.materialId,
                  plannedQty: c.plannedQty,
                  unit: c.unit,
                })),
              },
            },
            include: productionOrderInclude,
          });
          created.push(po);
        }
      }

      if (created.length === 0) {
        const fulfilledFromStock = analysis.lines.every(
          (line) => line.toProduceUnits === 0 && line.fromStockUnits >= line.requiredUnits,
        );

        if (!fulfilledFromStock) {
          throw new Error("Üretim gerektiren kalem yok veya stoktan karşılanıyor.");
        }

        await reserveStockForOrder(tx, orderId);
        await tx.order.update({
          where: { id: orderId },
          data: { status: "ready_ship" },
        });

        return created;
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "in_production" },
      });

      return created;
    },
    { timeout: 30_000 },
  );
}

export const productionOrderInclude = {
  order: { select: { orderNo: true } },
  product: {
    select: {
      sku: true,
      name: true,
      flavorId: true,
      packagingId: true,
      packaging: { select: { netWeightG: true, label: true } },
    },
  },
  recipe: {
    select: { code: true, name: true, yieldKg: true },
  },
  line: { select: { code: true, name: true, type: true } },
  consumptions: {
    include: {
      material: { select: { code: true, name: true, unit: true } },
      lot: { select: { internalLotNo: true, status: true } },
    },
  },
  scrapRecords: true,
} satisfies Prisma.ProductionOrderInclude;
