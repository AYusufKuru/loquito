import type { PrismaClient } from "@prisma/client";

import { applyProductionOutboundBatch } from "./stock-outbound";
import type { ProductionOutboundInput } from "./stock-outbound";
import { productionOrderInclude } from "./create-order";

export interface ConsumptionActualInput {
  consumptionId: string;
  actualQty: number;
  lotId?: string | null;
}

export interface CompleteProductionInput {
  producedUnits: number;
  scrapKg?: number;
  scrapReason?: string | null;
  consumptions: ConsumptionActualInput[];
}

export async function completeProductionOrder(
  db: PrismaClient,
  productionOrderId: string,
  input: CompleteProductionInput,
) {
  return db.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: {
        product: {
          include: { packaging: true },
        },
        consumptions: true,
      },
    });

    if (!order) throw new Error("Üretim emri bulunamadı.");
    if (order.status === "completed") throw new Error("Üretim emri zaten kapalı.");
    if (order.status === "cancelled") throw new Error("İptal edilmiş emir kapatılamaz.");

    const producedUnits = Math.max(0, Math.floor(input.producedUnits));
    if (producedUnits <= 0) throw new Error("Üretilen adet sıfırdan büyük olmalı.");

    const scrapKg = input.scrapKg ?? 0;
    const netWeightG = order.product?.packaging?.netWeightG ?? 0;
    const producedKg = (producedUnits * netWeightG) / 1000;

    const consumptionMap = new Map(
      order.consumptions.map((c) => [c.id, c]),
    );

    const outboundItems: ProductionOutboundInput[] = [];

    for (const row of input.consumptions) {
      const planned = consumptionMap.get(row.consumptionId);
      if (!planned) continue;

      const actualQty = row.actualQty;
      if (!Number.isFinite(actualQty) || actualQty < 0) {
        throw new Error("Geçersiz tüketim miktarı.");
      }

      if (actualQty > 0) {
        outboundItems.push({
          materialId: planned.materialId,
          quantity: actualQty,
          lotId: row.lotId,
          productionOrderId: order.id,
          notes: `${order.productionNo} tüketim`,
        });
      }
    }

    await applyProductionOutboundBatch(tx, outboundItems);

    for (const row of input.consumptions) {
      const planned = consumptionMap.get(row.consumptionId);
      if (!planned) continue;

      await tx.productionConsumption.update({
        where: { id: row.consumptionId },
        data: {
          actualQty: row.actualQty,
          lotId: row.lotId ?? null,
        },
      });
    }

    const yieldPercent =
      order.plannedKg > 0 ? Math.round((producedKg / order.plannedKg) * 1000) / 10 : null;

    if (scrapKg > 0) {
      await tx.scrapRecord.create({
        data: {
          productionOrderId: order.id,
          quantityKg: scrapKg,
          reason: input.scrapReason ?? "üretim fire",
        },
      });
    }

    if (order.product?.flavorId && order.product.packagingId) {
      const lotKey = order.lotNo;
      const existing = await tx.finishedGoodsStock.findFirst({
        where: {
          flavorId: order.product.flavorId,
          packagingId: order.product.packagingId,
          lotNo: lotKey,
        },
      });

      if (existing) {
        await tx.finishedGoodsStock.update({
          where: { id: existing.id },
          data: { quantity: { increment: producedUnits } },
        });
      } else {
        await tx.finishedGoodsStock.create({
          data: {
            flavorId: order.product.flavorId,
            packagingId: order.product.packagingId,
            productId: order.productId,
            lotNo: lotKey,
            quantity: producedUnits,
            status: "available",
          },
        });
      }
    }

    const updated = await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        status: "completed",
        producedUnits,
        producedKg,
        scrapKg,
        yieldPercent,
        actualEnd: new Date(),
        actualStart: order.actualStart ?? new Date(),
      },
      include: productionOrderInclude,
    });

    if (order.lineId) {
      const otherActive = await tx.productionOrder.findFirst({
        where: {
          lineId: order.lineId,
          status: "in_progress",
          id: { not: order.id },
        },
      });
      if (!otherActive) {
        const activeDowntime = await tx.downtime.findFirst({
          where: { lineId: order.lineId, endedAt: null },
        });
        await tx.line.update({
          where: { id: order.lineId },
          data: { status: activeDowntime ? "downtime" : "idle" },
        });
      }
    }

    return updated;
  }, { timeout: 60_000 });
}

export async function startProductionOrder(db: PrismaClient, productionOrderId: string, lineId?: string) {
  const order = await db.productionOrder.findUnique({ where: { id: productionOrderId } });
  if (!order) throw new Error("Üretim emri bulunamadı.");
  if (order.status !== "planned") throw new Error("Yalnızca planlı emirler başlatılabilir.");

  if (lineId) {
    await db.line.update({
      where: { id: lineId },
      data: { status: "running" },
    });
  }

  return db.productionOrder.update({
    where: { id: productionOrderId },
    data: {
      status: "in_progress",
      actualStart: new Date(),
      lineId: lineId ?? order.lineId,
      currentStage: "preparation",
      stageProgressPercent: 0,
    },
    include: productionOrderInclude,
  });
}

export async function assignProductionLine(
  db: PrismaClient,
  productionOrderId: string,
  lineId: string,
) {
  return db.productionOrder.update({
    where: { id: productionOrderId },
    data: { lineId },
    include: productionOrderInclude,
  });
}
