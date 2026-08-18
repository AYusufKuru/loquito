import type { PrismaClient } from "@prisma/client";

import {
  computeWorkedAndOvertime,
  getFactoryCookTeamSize,
  getFactoryLaborHoursPerBatch,
} from "@/lib/hr/labor";
import { getAvailableFinishedUnits } from "@/lib/finished-stock/availability";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orders/constants";
import { boxesPerBatch } from "@/lib/recipes/cost";

import {
  DIRECT_LABOR_EXPENSE_CATEGORY,
  OVERHEAD_METHOD_SETTING_KEY,
  parsePeriodMonth,
} from "./constants";
import type { OverheadAllocationMethod } from "./types";

type Db = PrismaClient;

export async function getOverheadAllocationMethod(db: Db): Promise<OverheadAllocationMethod> {
  const setting = await db.factorySetting.findUnique({
    where: { key: OVERHEAD_METHOD_SETTING_KEY },
  });
  return setting?.value === "hours" ? "hours" : "kg";
}

export async function setOverheadAllocationMethod(
  db: Db,
  method: OverheadAllocationMethod,
): Promise<void> {
  await db.factorySetting.upsert({
    where: { key: OVERHEAD_METHOD_SETTING_KEY },
    update: { value: method },
    create: {
      key: OVERHEAD_METHOD_SETTING_KEY,
      value: method,
      label: "Genel gider dağıtım yöntemi (kg | hours)",
      category: "finance",
    },
  });
}

export async function getMonthlyOverheadPool(db: Db, periodMonth: string): Promise<number> {
  const rows = await db.fixedExpense.findMany({
    where: { periodMonth, isActive: true },
  });
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}

/**
 * Siparişe dağıtılacak genel gider havuzu. Personel giderleri hariç tutulur;
 * bunlar sipariş analizinde doğrudan işçilik kalemi olarak zaten sayılır.
 */
export async function getAllocatableOverheadPool(
  db: Db,
  periodMonth: string,
): Promise<number> {
  const rows = await db.fixedExpense.findMany({
    where: {
      periodMonth,
      isActive: true,
      category: { not: DIRECT_LABOR_EXPENSE_CATEGORY },
    },
  });
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}

function lineProductionKg(
  toProduceUnits: number,
  netWeightG: number,
  batchesNeeded: number,
  yieldKg: number,
): number {
  if (toProduceUnits > 0 && netWeightG > 0) {
    return (toProduceUnits * netWeightG) / 1000;
  }
  if (batchesNeeded > 0 && yieldKg > 0) {
    return batchesNeeded * yieldKg;
  }
  return 0;
}

async function computeItemToProduce(
  db: Db,
  item: {
    quantityUnits: number;
    quantityBoxes: number;
    product: {
      flavorId: string | null;
      packagingId: string | null;
      packaging: { unitsPerBox: number; netWeightG: number } | null;
      recipe: { yieldKg: number } | null;
    };
  },
): Promise<{ toProduceUnits: number; toProduceBoxes: number; batchesNeeded: number; productionKg: number }> {
  const product = item.product;
  const packaging = product.packaging;
  const recipe = product.recipe;
  const unitsPerBox = packaging?.unitsPerBox ?? 0;

  const stockUnits =
    product.flavorId && product.packagingId
      ? await getAvailableFinishedUnits(db, product.flavorId, product.packagingId)
      : 0;

  const requiredUnits = item.quantityUnits;
  const fromStockUnits = Math.min(requiredUnits, stockUnits);
  const toProduceUnits = Math.max(0, requiredUnits - fromStockUnits);
  const toProduceBoxes =
    unitsPerBox > 0
      ? Math.ceil(toProduceUnits / unitsPerBox)
      : Math.max(
          0,
          item.quantityBoxes - Math.floor(fromStockUnits / (unitsPerBox || 1)),
        );

  let batchesNeeded = 0;
  if (recipe && packaging && toProduceBoxes > 0) {
    const boxesPerBatchCount = boxesPerBatch(recipe.yieldKg, packaging.netWeightG);
    batchesNeeded =
      boxesPerBatchCount > 0 ? Math.ceil(toProduceBoxes / boxesPerBatchCount) : 1;
  }

  const productionKg = lineProductionKg(
    toProduceUnits,
    packaging?.netWeightG ?? 0,
    batchesNeeded,
    recipe?.yieldKg ?? 0,
  );

  return { toProduceUnits, toProduceBoxes, batchesNeeded, productionKg };
}

export async function computeMonthlyProductionKg(db: Db, periodMonth: string): Promise<number> {
  const range = parsePeriodMonth(periodMonth);
  if (!range) return 0;

  const orders = await db.order.findMany({
    where: {
      status: { in: [...ACTIVE_ORDER_STATUSES] },
      orderDate: { gte: range.start, lte: range.end },
    },
    include: {
      items: {
        include: {
          product: {
            include: { packaging: true, recipe: true },
          },
        },
      },
    },
  });

  let totalKg = 0;
  for (const order of orders) {
    for (const item of order.items) {
      const metrics = await computeItemToProduce(db, item);
      totalKg += metrics.productionKg;
    }
  }
  return totalKg;
}

export async function computeOrderProductionKg(db: Db, orderId: string): Promise<number> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: { packaging: true, recipe: true },
          },
        },
      },
    },
  });
  if (!order) return 0;

  let totalKg = 0;
  for (const item of order.items) {
    const metrics = await computeItemToProduce(db, item);
    totalKg += metrics.productionKg;
  }
  return totalKg;
}

export async function computeOrderLineProductionKg(
  db: Db,
  orderId: string,
): Promise<Map<string, number>> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: { packaging: true, recipe: true },
          },
        },
      },
    },
  });
  const map = new Map<string, number>();
  if (!order) return map;

  for (const item of order.items) {
    const metrics = await computeItemToProduce(db, item);
    map.set(item.productId, metrics.productionKg);
  }
  return map;
}

export async function computeMonthlyWorkedHours(db: Db, periodMonth: string): Promise<number> {
  const range = parsePeriodMonth(periodMonth);
  if (!range) return 0;

  const assignments = await db.workAssignment.findMany({
    where: { date: { gte: range.start, lte: range.end } },
  });
  const assignmentHours = assignments.reduce((sum, row) => sum + row.hours, 0);
  if (assignmentHours > 0) return assignmentHours;

  const attendance = await db.attendance.findMany({
    where: { date: { gte: range.start, lte: range.end } },
  });

  let hours = 0;
  for (const row of attendance) {
    const { workedHours, overtimeHours } = computeWorkedAndOvertime(
      row.clockIn,
      row.clockOut,
      row.workedHours,
      row.overtimeHours,
    );
    hours += workedHours + overtimeHours;
  }
  return hours;
}

export async function computeOrderWorkedHours(db: Db, orderId: string): Promise<number> {
  const assignments = await db.workAssignment.findMany({
    where: {
      productionOrder: { orderId },
    },
  });
  const recorded = assignments.reduce((sum, row) => sum + row.hours, 0);
  if (recorded > 0) return recorded;

  const hoursPerBatch = await getFactoryLaborHoursPerBatch(db);
  const teamSize = await getFactoryCookTeamSize(db);

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: { packaging: true, recipe: true },
          },
        },
      },
    },
  });
  if (!order) return 0;

  let batches = 0;
  for (const item of order.items) {
    const metrics = await computeItemToProduce(db, item);
    batches += metrics.batchesNeeded;
  }
  return batches * hoursPerBatch * teamSize;
}

export interface OrderOverheadAllocation {
  periodMonth: string;
  allocationMethod: OverheadAllocationMethod;
  monthlyOverheadCents: number;
  monthlyDenominator: number;
  orderWeight: number;
  orderOverheadCents: number;
  lineOverheadCents: Map<string, number>;
}

export async function allocateOrderOverhead(
  db: Db,
  orderId: string,
  lineWeights?: Map<string, number>,
): Promise<OrderOverheadAllocation> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { orderDate: true },
  });
  if (!order) {
    return {
      periodMonth: "",
      allocationMethod: "kg",
      monthlyOverheadCents: 0,
      monthlyDenominator: 0,
      orderWeight: 0,
      orderOverheadCents: 0,
      lineOverheadCents: new Map(),
    };
  }

  const periodMonth = `${order.orderDate.getFullYear()}-${String(
    order.orderDate.getMonth() + 1,
  ).padStart(2, "0")}`;

  const method = await getOverheadAllocationMethod(db);
  const monthlyOverheadCents = await getAllocatableOverheadPool(db, periodMonth);

  let monthlyDenominator = 0;
  let orderWeight = 0;

  if (method === "kg") {
    monthlyDenominator = await computeMonthlyProductionKg(db, periodMonth);
    orderWeight = await computeOrderProductionKg(db, orderId);
  } else {
    monthlyDenominator = await computeMonthlyWorkedHours(db, periodMonth);
    orderWeight = await computeOrderWorkedHours(db, orderId);
  }

  const orderOverheadCents =
    monthlyDenominator > 0 && orderWeight > 0
      ? Math.round((monthlyOverheadCents * orderWeight) / monthlyDenominator)
      : 0;

  const lineOverheadCents = new Map<string, number>();
  let weights: Map<string, number>;

  if (method === "hours") {
    const hoursPerBatch = await getFactoryLaborHoursPerBatch(db);
    const teamSize = await getFactoryCookTeamSize(db);
    const orderWithItems = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { packaging: true, recipe: true },
            },
          },
        },
      },
    });
    weights = new Map<string, number>();
    if (orderWithItems) {
      for (const item of orderWithItems.items) {
        const metrics = await computeItemToProduce(db, item);
        weights.set(
          item.productId,
          metrics.batchesNeeded * hoursPerBatch * teamSize,
        );
      }
    }
  } else {
    weights =
      lineWeights ?? (await computeOrderLineProductionKg(db, orderId));
  }

  distributeOverheadToLines(orderOverheadCents, weights, lineOverheadCents);

  return {
    periodMonth,
    allocationMethod: method,
    monthlyOverheadCents,
    monthlyDenominator,
    orderWeight,
    orderOverheadCents,
    lineOverheadCents,
  };
}

function distributeOverheadToLines(
  totalCents: number,
  weights: Map<string, number>,
  out: Map<string, number>,
): void {
  const entries = Array.from(weights.entries());
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0 || totalCents <= 0) return;

  let allocated = 0;
  for (let i = 0; i < entries.length; i++) {
    const [productId, weight] = entries[i];
    if (i === entries.length - 1) {
      out.set(productId, totalCents - allocated);
    } else {
      const share = Math.round((totalCents * weight) / totalWeight);
      out.set(productId, share);
      allocated += share;
    }
  }
}

export async function getOverheadSummary(db: Db, periodMonth: string) {
  const method = await getOverheadAllocationMethod(db);
  const monthlyOverheadCents = await getAllocatableOverheadPool(db, periodMonth);
  const monthlyDenominator =
    method === "kg"
      ? await computeMonthlyProductionKg(db, periodMonth)
      : await computeMonthlyWorkedHours(db, periodMonth);

  const denominatorLabel = method === "kg" ? "kg" : "saat";
  const costPerUnitCents =
    monthlyDenominator > 0 ? Math.round(monthlyOverheadCents / monthlyDenominator) : 0;

  return {
    periodMonth,
    allocationMethod: method,
    monthlyOverheadCents,
    monthlyDenominator,
    denominatorLabel,
    costPerUnitCents,
  };
}

export async function estimateOrderOverheadFromLines(
  orderOverheadCents: number,
  lineProductionKg: number[],
  lineBatches: number[],
  method: OverheadAllocationMethod,
): Promise<number[]> {
  const weights =
    method === "kg" ? lineProductionKg : lineBatches.map((b) => b > 0 ? b : 0);
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || orderOverheadCents <= 0) return weights.map(() => 0);

  const result: number[] = [];
  let allocated = 0;
  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      result.push(orderOverheadCents - allocated);
    } else {
      const share = Math.round((orderOverheadCents * weights[i]) / total);
      result.push(share);
      allocated += share;
    }
  }
  return result;
}
