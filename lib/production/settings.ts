import type { PrismaClient } from "@prisma/client";

import { parseWorkDaysPattern, type WorkDaysPattern } from "./calendar";

export interface ProductionSettings {
  batchYieldKg: number;
  batchCookHours: number;
  coolingDays: number;
  potCount: number;
  referenceOrderBoxes: number;
  referenceOrderDays: number;
  workDays: WorkDaysPattern;
  workStart: string;
  workEnd: string;
  cuttingTeamSize: number;
  dailyCapacity250g: number;
  dailyCapacity85g: number;
}

const DEFAULTS: ProductionSettings = {
  batchYieldKg: 70,
  batchCookHours: 3.5,
  coolingDays: 1,
  potCount: 3,
  referenceOrderBoxes: 10000,
  referenceOrderDays: 4,
  workDays: "mon-fri",
  workStart: "08:00",
  workEnd: "17:00",
  cuttingTeamSize: 10,
  dailyCapacity250g: 2500,
  dailyCapacity85g: 0,
};

function num(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadProductionSettings(db: PrismaClient): Promise<ProductionSettings> {
  const rows = await db.factorySetting.findMany({
    where: { category: { in: ["production", "schedule"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    batchYieldKg: num(map.get("batch_yield_kg"), DEFAULTS.batchYieldKg),
    batchCookHours: num(map.get("batch_cook_hours"), DEFAULTS.batchCookHours),
    coolingDays: num(map.get("cooling_days"), DEFAULTS.coolingDays),
    potCount: num(map.get("kazan_count"), DEFAULTS.potCount),
    referenceOrderBoxes: num(map.get("reference_order_boxes"), DEFAULTS.referenceOrderBoxes),
    referenceOrderDays: num(map.get("reference_order_days"), DEFAULTS.referenceOrderDays),
    workDays: parseWorkDaysPattern(map.get("work_days") ?? "mon-fri"),
    workStart: map.get("work_start") ?? DEFAULTS.workStart,
    workEnd: map.get("work_end") ?? DEFAULTS.workEnd,
    cuttingTeamSize: num(map.get("cutting_team_size"), DEFAULTS.cuttingTeamSize),
    dailyCapacity250g: num(map.get("daily_capacity_250g"), DEFAULTS.dailyCapacity250g),
    dailyCapacity85g: num(map.get("daily_capacity_85g"), DEFAULTS.dailyCapacity85g),
  };
}

export function getDailyCuttingCapacity(
  settings: ProductionSettings,
  netWeightG: number,
): number {
  if (netWeightG === 250 && settings.dailyCapacity250g > 0) {
    return settings.dailyCapacity250g;
  }
  if (netWeightG === 85 && settings.dailyCapacity85g > 0) {
    return settings.dailyCapacity85g;
  }

  const referenceDaily =
    settings.referenceOrderDays > 0
      ? settings.referenceOrderBoxes / settings.referenceOrderDays
      : settings.dailyCapacity250g;

  const base250 =
    settings.dailyCapacity250g > 0 ? settings.dailyCapacity250g : referenceDaily;

  if (netWeightG <= 0) return Math.round(base250);
  return Math.round(base250 * (250 / netWeightG));
}
