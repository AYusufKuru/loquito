import type { PrismaClient } from "@prisma/client";

import { analyzeOrderProduction } from "@/lib/orders/production-analysis";
import { boxesPerBatch } from "@/lib/recipes/cost";

import {
  normalizeToWorkDay,
  toIsoDate,
  workDayToDate,
} from "./calendar";
import { getDailyCuttingCapacity, loadProductionSettings } from "./settings";
import type {
  PlanLineInput,
  PlanningDayEntry,
  ProductionPlanResult,
} from "./types";

interface BatchJob {
  boxes: number;
  grammage: number;
}

export function buildProductionPlan(
  lines: PlanLineInput[],
  settings: Awaited<ReturnType<typeof loadProductionSettings>>,
  startDate: Date,
  deliveryDate?: Date | null,
): ProductionPlanResult {
  const activeLines = lines.filter((l) => l.toProduceBoxes > 0 && l.batchesNeeded > 0);
  const jobs = buildBatchJobs(activeLines);

  const cookDays = scheduleCooking(jobs, settings.potCount);
  const timeline = simulateTimeline(jobs, cookDays, settings, startDate);

  const totalBoxesToProduce = activeLines.reduce((s, l) => s + l.toProduceBoxes, 0);
  const totalBatches = jobs.length;
  const cookingWorkDays = cookDays.length;
  const cuttingWorkDays = timeline.filter((d) => d.cuttingBoxes > 0).length;
  const totalWorkDays = timeline.length;
  const estimatedCompletionDate = timeline[timeline.length - 1]?.date ?? toIsoDate(startDate);

  let meetsDelivery: boolean | null = null;
  let estimatedDeliveryDate = estimatedCompletionDate;
  if (deliveryDate) {
    const completion = new Date(`${estimatedCompletionDate}T12:00:00`);
    meetsDelivery = completion <= deliveryDate;
    estimatedDeliveryDate = estimatedCompletionDate;
  }

  return {
    startDate: timeline[0]?.date ?? toIsoDate(normalizeToWorkDay(startDate, settings.workDays)),
    estimatedCompletionDate,
    estimatedDeliveryDate,
    deliveryDateRequested: deliveryDate ? toIsoDate(deliveryDate) : null,
    totalBatches,
    totalBoxesToProduce,
    cookingWorkDays,
    cuttingWorkDays,
    totalWorkDays,
    timeline,
    lines: activeLines.map((l) => ({
      productSku: l.productSku ?? "—",
      productName: l.productName ?? "",
      netWeightG: l.netWeightG,
      toProduceBoxes: l.toProduceBoxes,
      batchesNeeded: l.batchesNeeded,
      dailyCapacity: getDailyCuttingCapacity(settings, l.netWeightG),
    })),
    meetsDelivery,
    settingsSnapshot: {
      potCount: settings.potCount,
      batchYieldKg: settings.batchYieldKg,
      coolingDays: settings.coolingDays,
      dailyCapacity250g: settings.dailyCapacity250g,
    },
  };
}

function buildBatchJobs(lines: PlanLineInput[]): BatchJob[] {
  const jobs: BatchJob[] = [];

  for (const line of lines) {
    let remaining = line.toProduceBoxes;
    const bpp = line.boxesPerBatch > 0 ? line.boxesPerBatch : 1;

    for (let i = 0; i < line.batchesNeeded; i++) {
      // Talep karşılandıysa fazladan parti planlanmaz.
      if (remaining <= 0) break;
      const boxes = Math.min(bpp, remaining);
      jobs.push({ boxes, grammage: line.netWeightG });
      remaining -= boxes;
    }
  }

  return jobs;
}

function scheduleCooking(jobs: BatchJob[], potCount: number): BatchJob[][] {
  const cookDays: BatchJob[][] = [];
  const pots = Math.max(1, potCount);

  for (let i = 0; i < jobs.length; i += pots) {
    cookDays.push(jobs.slice(i, i + pots));
  }

  return cookDays;
}

function simulateTimeline(
  jobs: BatchJob[],
  cookDays: BatchJob[][],
  settings: Awaited<ReturnType<typeof loadProductionSettings>>,
  startDate: Date,
): PlanningDayEntry[] {
  if (jobs.length === 0) {
    const date = toIsoDate(workDayToDate(startDate, 1, settings.workDays));
    return [
      {
        date,
        workDayIndex: 1,
        cookingBatches: 0,
        cuttingBoxes: 0,
        cumulativeCutBoxes: 0,
      },
    ];
  }

  const totalBoxes = jobs.reduce((s, j) => s + j.boxes, 0);
  let queue: BatchJob[] = [];
  let cookedDayIndex = 0;
  let totalCut = 0;
  const timeline: PlanningDayEntry[] = [];
  let workDay = 0;
  const maxDays = cookDays.length + 365;

  while (workDay < maxDays) {
    workDay++;
    const date = toIsoDate(workDayToDate(startDate, workDay, settings.workDays));

    if (workDay > settings.coolingDays) {
      const readyCookIndex = workDay - settings.coolingDays - 1;
      if (readyCookIndex >= 0 && readyCookIndex < cookDays.length) {
        queue.push(...cookDays[readyCookIndex]);
      }
    }

    let cookingBatches = 0;
    if (cookedDayIndex < cookDays.length) {
      cookingBatches = cookDays[cookedDayIndex].length;
      cookedDayIndex++;
    }

    const capRemaining = new Map<number, number>();
    let cuttingBoxes = 0;
    const newQueue: BatchJob[] = [];

    for (const item of queue) {
      if (!capRemaining.has(item.grammage)) {
        capRemaining.set(
          item.grammage,
          getDailyCuttingCapacity(settings, item.grammage),
        );
      }
      const cap = capRemaining.get(item.grammage) ?? 0;
      const cut = Math.min(item.boxes, cap);
      cuttingBoxes += cut;
      capRemaining.set(item.grammage, cap - cut);
      const leftover = item.boxes - cut;
      if (leftover > 0) {
        newQueue.push({ boxes: leftover, grammage: item.grammage });
      }
    }

    queue = newQueue;
    totalCut += cuttingBoxes;

    timeline.push({
      date,
      workDayIndex: workDay,
      cookingBatches,
      cuttingBoxes,
      cumulativeCutBoxes: totalCut,
    });

    const allCooked = cookedDayIndex >= cookDays.length;
    const allCut = totalCut >= totalBoxes && queue.length === 0;
    if (allCooked && allCut) break;
  }

  return timeline;
}

export async function planOrderProduction(
  db: PrismaClient,
  orderId: string,
  startDate?: Date,
): Promise<(ProductionPlanResult & { orderId: string; orderNo: string }) | null> {
  const analysis = await analyzeOrderProduction(db, orderId);
  if (!analysis) return null;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { deliveryDate: true },
  });

  const items = await db.orderItem.findMany({
    where: { orderId },
    include: {
      product: {
        include: { packaging: { select: { netWeightG: true } } },
      },
    },
  });

  const grammageByProduct = new Map(
    items.map((i) => [i.productId, i.product.packaging?.netWeightG ?? 250]),
  );

  const lines: PlanLineInput[] = analysis.lines
    .filter((l) => l.toProduceBoxes > 0)
    .map((l) => ({
      productSku: l.productSku,
      productName: l.productName,
      netWeightG: grammageByProduct.get(l.productId) ?? 250,
      toProduceBoxes: l.toProduceBoxes,
      boxesPerBatch: l.boxesPerBatch,
      batchesNeeded: l.batchesNeeded,
    }));

  const settings = await loadProductionSettings(db);
  const plan = buildProductionPlan(
    lines,
    settings,
    startDate ?? new Date(),
    order?.deliveryDate ?? null,
  );

  return {
    ...plan,
    orderId,
    orderNo: analysis.orderNo,
  };
}

export function buildScenarioPlan(
  boxes: number,
  netWeightG: number,
  settings: Awaited<ReturnType<typeof loadProductionSettings>>,
  startDate: Date,
): ProductionPlanResult {
  const bpp = boxesPerBatch(settings.batchYieldKg, netWeightG);
  const batchesNeeded = bpp > 0 ? Math.ceil(boxes / bpp) : 1;

  return buildProductionPlan(
    [
      {
        productSku: `SENARYO-${netWeightG}g`,
        productName: `${boxes} koli senaryo`,
        netWeightG,
        toProduceBoxes: boxes,
        boxesPerBatch: bpp,
        batchesNeeded,
      },
    ],
    settings,
    startDate,
  );
}
