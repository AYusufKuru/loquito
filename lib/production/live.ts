import type { Prisma } from "@prisma/client";

import { cachedQuery, REVALIDATE, todayCacheKey } from "@/lib/cache/server";

import { productionOrderInclude } from "./create-order";
import { loadProductionSettings } from "./settings";
import {
  CUTTING_STAGES,
  LINE_STATUS_LABELS,
  PACKAGING_STAGES,
  STAGE_LABELS,
  SHIFT_LABELS,
  type ProductionStage,
} from "./stages";

type Db = import("@prisma/client").PrismaClient;

type LiveOrderRow = Prisma.ProductionOrderGetPayload<{
  include: typeof productionOrderInclude;
}>;

export async function getLiveProductionBoard(db: Db) {
  return cachedQuery(
    ["live-production-board", todayCacheKey()],
    () => buildLiveProductionBoard(db),
    REVALIDATE.live,
    ["production", "dashboard"],
  );
}

/** Canlı takip API — önbelleksiz, anlık veri */
export async function getLiveProductionBoardFresh(db: Db) {
  return buildLiveProductionBoard(db);
}

async function buildLiveProductionBoard(db: Db) {
  const lines = await db.line.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      downtimes: {
        where: { endedAt: null },
        take: 1,
      },
    },
  });

  const activeOrders = await db.productionOrder.findMany({
    where: { status: "in_progress" },
    include: productionOrderInclude,
  });

  const settings = await loadProductionSettings(db);

  const cookers = lines
    .filter((l) => l.type === "cooker")
    .map((line) => {
      const order = activeOrders.find((o) => o.lineId === line.id);
      const downtime = line.downtimes[0];
      const effectiveStatus = order
        ? downtime
          ? "downtime"
          : line.status
        : downtime
          ? "downtime"
          : "idle";
      return {
        lineId: line.id,
        lineCode: line.code,
        lineName: line.name,
        lineStatus: effectiveStatus,
        lineStatusLabel: LINE_STATUS_LABELS[effectiveStatus] ?? effectiveStatus,
        dailyTargetUnits: line.dailyTargetUnits,
        dailyProducedUnits: line.dailyProducedUnits,
        teamSize: line.teamSize,
        activeOrder: order ? serializeLiveOrder(order) : null,
        activeDowntime: downtime
          ? {
              id: downtime.id,
              reason: downtime.reason,
              startedAt: downtime.startedAt.toISOString(),
              notes: downtime.notes,
            }
          : null,
      };
    });

  function buildLineCard(type: string) {
    const line = lines.find((l) => l.type === type);
    if (!line) return null;

    const lineOrders = activeOrders.filter(
      (o) =>
        o.lineId === line.id ||
        (type === "cutting" &&
          CUTTING_STAGES.includes(o.currentStage as ProductionStage)) ||
        (type === "packaging" &&
          PACKAGING_STAGES.includes(o.currentStage as ProductionStage)),
    );

    const downtime = line.downtimes[0];
    const hasWork = lineOrders.length > 0;
    const effectiveStatus = hasWork
      ? downtime
        ? "downtime"
        : line.status
      : downtime
        ? "downtime"
        : "idle";
    const target =
      line.dailyTargetUnits > 0
        ? line.dailyTargetUnits
        : settings.dailyCapacity250g;
    const produced = line.dailyProducedUnits;
    const progressPercent =
      target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;

    return {
      lineId: line.id,
      lineCode: line.code,
      lineName: line.name,
      lineStatus: effectiveStatus,
      lineStatusLabel: LINE_STATUS_LABELS[effectiveStatus] ?? effectiveStatus,
      dailyTargetUnits: target,
      dailyProducedUnits: produced,
      teamSize: line.teamSize,
      progressPercent,
      activeOrders: lineOrders.map(serializeLiveOrder),
      activeDowntime: downtime
        ? {
            id: downtime.id,
            reason: downtime.reason,
            startedAt: downtime.startedAt.toISOString(),
            notes: downtime.notes,
          }
        : null,
    };
  }

  return {
    cookers,
    cuttingLine: buildLineCard("cutting"),
    packagingLine: buildLineCard("packaging"),
    potCount: settings.potCount,
    batchYieldKg: settings.batchYieldKg,
  };
}

function serializeLiveOrder(order: LiveOrderRow) {
  const stage = order.currentStage as ProductionStage;
  return {
    id: order.id,
    productionNo: order.productionNo,
    lotNo: order.lotNo,
    orderNo: order.order?.orderNo ?? null,
    productSku: order.product?.sku ?? null,
    productName: order.product?.name ?? null,
    recipeCode: order.recipe.code,
    currentStage: stage,
    currentStageLabel: STAGE_LABELS[stage] ?? order.currentStage,
    currentKg: order.currentKg,
    plannedKg: order.plannedKg,
    stageProgressPercent: order.stageProgressPercent,
    producedUnits: order.producedUnits,
    scrapKg: order.scrapKg,
    shift: order.shift,
    shiftLabel: order.shift
      ? SHIFT_LABELS[order.shift as keyof typeof SHIFT_LABELS] ?? order.shift
      : null,
    operatorName: order.operatorName,
    qualityStatus: order.qualityStatus,
    lineCode: order.line?.code ?? null,
  };
}
