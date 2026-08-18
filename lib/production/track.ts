import type { PrismaClient } from "@prisma/client";

import { loadProductionSettings } from "./settings";
import { productionOrderInclude } from "./create-order";
import {
  CUTTING_STAGES,
  PACKAGING_STAGES,
  nextStage,
  stageLineType,
  type ProductionStage,
  type QualityDecision,
  type Shift,
} from "./stages";

type Db = PrismaClient;

export interface TrackProgressInput {
  currentKg?: number;
  stageProgressPercent?: number;
  producedUnits?: number;
  shift?: Shift;
  operatorName?: string;
}

export async function updateProductionProgress(
  db: Db,
  productionOrderId: string,
  input: TrackProgressInput,
) {
  const order = await db.productionOrder.findUnique({ where: { id: productionOrderId } });
  if (!order) throw new Error("Üretim emri bulunamadı.");
  if (order.status !== "in_progress") throw new Error("Yalnızca devam eden emirler güncellenebilir.");

  const data: Record<string, unknown> = {};
  if (input.currentKg != null) data.currentKg = Math.max(0, input.currentKg);
  if (input.stageProgressPercent != null) {
    data.stageProgressPercent = Math.min(100, Math.max(0, input.stageProgressPercent));
  }
  if (input.producedUnits != null) {
    data.producedUnits = Math.max(0, Math.floor(input.producedUnits));
  }
  if (input.shift) data.shift = input.shift;
  if (input.operatorName !== undefined) data.operatorName = input.operatorName || null;

  if (input.producedUnits != null && order.lineId) {
    await syncLineDailyProduced(db, order.lineId);
  }

  return db.productionOrder.update({
    where: { id: productionOrderId },
    data,
    include: productionOrderInclude,
  });
}

export async function advanceProductionStage(db: Db, productionOrderId: string) {
  const order = await db.productionOrder.findUnique({
    where: { id: productionOrderId },
    include: { line: true },
  });
  if (!order) throw new Error("Üretim emri bulunamadı.");
  if (order.status !== "in_progress") throw new Error("Yalnızca devam eden emirler ilerletilebilir.");

  const current = order.currentStage as ProductionStage;
  const next = nextStage(current);
  if (!next) throw new Error("Son aşamaya ulaşıldı.");

  const currentLineType = stageLineType(current);
  const nextLineType = stageLineType(next);
  let lineId = order.lineId;

  // Pişirme aşamaları (hazırlık → pişirme → karıştırma → soğutma) aynı
  // kazanda devam eder; yalnızca hat tipi değişince (kesim/paket) yeni hat atanır.
  if (nextLineType && nextLineType !== currentLineType) {
    const targetLine = await db.line.findFirst({
      where: { type: nextLineType, isActive: true },
      orderBy: { code: "asc" },
    });
    if (targetLine) lineId = targetLine.id;
  }

  if (order.lineId && order.lineId !== lineId) {
    await db.line.update({
      where: { id: order.lineId },
      data: { status: "idle" },
    });
  }

  if (lineId) {
    await db.line.update({
      where: { id: lineId },
      data: { status: "running" },
    });
  }

  return db.productionOrder.update({
    where: { id: productionOrderId },
    data: {
      currentStage: next,
      stageProgressPercent: 0,
      lineId,
    },
    include: productionOrderInclude,
  });
}

export async function recordLiveScrap(
  db: Db,
  productionOrderId: string,
  quantityKg: number,
  reason?: string | null,
  notes?: string | null,
) {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new Error("Fire miktarı geçersiz.");
  }

  const order = await db.productionOrder.findUnique({ where: { id: productionOrderId } });
  if (!order) throw new Error("Üretim emri bulunamadı.");

  await db.scrapRecord.create({
    data: {
      productionOrderId,
      quantityKg,
      reason: reason ?? null,
      notes: notes ?? null,
    },
  });

  return db.productionOrder.update({
    where: { id: productionOrderId },
    data: { scrapKg: { increment: quantityKg } },
    include: productionOrderInclude,
  });
}

export interface QualityCheckInput {
  stage: string;
  parameter?: string | null;
  targetValue?: string | null;
  actualValue?: string | null;
  unit?: string | null;
  compliance?: QualityDecision | null;
  correctiveAction?: string | null;
  notes?: string | null;
  checkedBy?: string | null;
}

export async function recordQualityCheck(
  db: Db,
  productionOrderId: string,
  input: QualityCheckInput,
) {
  const order = await db.productionOrder.findUnique({ where: { id: productionOrderId } });
  if (!order) throw new Error("Üretim emri bulunamadı.");

  await db.qualityCheck.create({
    data: {
      productionOrderId,
      stage: input.stage,
      parameter: input.parameter ?? null,
      targetValue: input.targetValue ?? null,
      actualValue: input.actualValue ?? null,
      unit: input.unit ?? null,
      compliance: input.compliance ?? "pending",
      correctiveAction: input.correctiveAction ?? null,
      notes: input.notes ?? null,
      checkedAt: new Date(),
      checkedBy: input.checkedBy ?? null,
    },
  });

  const qualityStatus = input.compliance ?? order.qualityStatus;

  return db.productionOrder.update({
    where: { id: productionOrderId },
    data: { qualityStatus: qualityStatus ?? "pending" },
    include: productionOrderInclude,
  });
}

export async function startLineDowntime(
  db: Db,
  lineId: string,
  reason: string,
  productionOrderId?: string | null,
  notes?: string | null,
) {
  if (!reason.trim()) throw new Error("Duruş nedeni gerekli.");

  const active = await db.downtime.findFirst({
    where: { lineId, endedAt: null },
  });
  if (active) throw new Error("Hat zaten duruşta.");

  await db.line.update({
    where: { id: lineId },
    data: { status: "downtime" },
  });

  await db.downtime.create({
    data: {
      lineId,
      productionOrderId: productionOrderId ?? null,
      reason: reason.trim(),
      startedAt: new Date(),
      notes: notes ?? null,
    },
  });

  return db.line.findUnique({
    where: { id: lineId },
    include: {
      downtimes: {
        where: { endedAt: null },
        take: 1,
      },
    },
  });
}

export async function endLineDowntime(db: Db, lineId: string) {
  const active = await db.downtime.findFirst({
    where: { lineId, endedAt: null },
  });
  if (!active) throw new Error("Aktif duruş kaydı yok.");

  await db.downtime.update({
    where: { id: active.id },
    data: { endedAt: new Date() },
  });

  const runningOrder = await db.productionOrder.findFirst({
    where: { lineId, status: "in_progress" },
  });

  await db.line.update({
    where: { id: lineId },
    data: { status: runningOrder ? "running" : "idle" },
  });

  return db.line.findUnique({ where: { id: lineId } });
}

async function syncLineDailyProduced(db: Db, lineId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await db.productionOrder.findMany({
    where: {
      lineId,
      status: { in: ["in_progress", "completed"] },
      updatedAt: { gte: today },
    },
  });

  const total = orders.reduce((s, o) => s + o.producedUnits, 0);
  await db.line.update({
    where: { id: lineId },
    data: { dailyProducedUnits: total },
  });
}

export async function syncLineStatuses(db: Db) {
  const [lines, activeOrders, activeDowntimes] = await Promise.all([
    db.line.findMany({ where: { isActive: true } }),
    db.productionOrder.findMany({
      where: { status: "in_progress" },
      select: { lineId: true, currentStage: true },
    }),
    db.downtime.findMany({
      where: { endedAt: null },
      select: { lineId: true },
    }),
  ]);

  const downtimeLineIds = new Set(activeDowntimes.map((d) => d.lineId));

  for (const line of lines) {
    const hasWork = activeOrders.some((order) => {
      if (order.lineId === line.id) return true;
      if (
        line.type === "cutting" &&
        CUTTING_STAGES.includes(order.currentStage as ProductionStage)
      ) {
        return true;
      }
      if (
        line.type === "packaging" &&
        PACKAGING_STAGES.includes(order.currentStage as ProductionStage)
      ) {
        return true;
      }
      return false;
    });

    const nextStatus = downtimeLineIds.has(line.id)
      ? "downtime"
      : hasWork
        ? "running"
        : "idle";

    if (line.status !== nextStatus) {
      await db.line.update({
        where: { id: line.id },
        data: { status: nextStatus },
      });
    }
  }
}

export async function initLineDailyTargets(db: Db) {
  const settings = await loadProductionSettings(db);

  await db.line.updateMany({
    where: { type: "cutting" },
    data: {
      dailyTargetUnits: settings.dailyCapacity250g,
      teamSize: settings.cuttingTeamSize,
    },
  });

  await db.line.updateMany({
    where: { type: "packaging" },
    data: {
      dailyTargetUnits: settings.dailyCapacity250g,
      teamSize: settings.cuttingTeamSize,
    },
  });
}
