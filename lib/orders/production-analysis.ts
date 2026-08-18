import type { PrismaClient } from "@prisma/client";
import { cache } from "react";

import {
  boxesPerBatch,
  computePackagingCostCents,
  computeRawCostCents,
  isOverheadMaterial,
  isPerBatchItem,
} from "@/lib/recipes/cost";
import {
  computeLaborCostCents,
  computeOrderLaborCost,
  getAvgProductionHourlyRateCents,
  getFactoryCookTeamSize,
  getFactoryLaborHoursPerBatch,
} from "@/lib/hr/labor";
import { allocateOrderOverhead } from "@/lib/finance/overhead";
import { getAvailableFinishedUnitsMap } from "@/lib/finished-stock/availability";
import { getAvailableQtyMap } from "@/lib/stock/inventory";

type Db = PrismaClient;

export interface LineAnalysisRow {
  productId: string;
  productSku: string;
  productName: string;
  requiredUnits: number;
  requiredBoxes: number;
  stockUnits: number;
  fromStockUnits: number;
  toProduceUnits: number;
  toProduceBoxes: number;
  boxesPerBatch: number;
  batchesNeeded: number;
  revenueCents: number;
  materialCostCents: number;
  laborCostCents: number;
  overheadCostCents: number;
  productionKg: number;
  productionCostCents: number;
  expectedProfitCents: number;
}

export interface MaterialNeedRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  category: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
  isShort: boolean;
  /** Meyve gibi günlük alınan kalemler stokta tutulmaz, üretimi engellemez. */
  isDailySupply: boolean;
  /** Su gibi genel gider kalemleri maliyete ve eksik kontrolüne girmez. */
  isOverhead: boolean;
}

export interface OrderProductionAnalysis {
  orderId: string;
  orderNo: string;
  customerName: string;
  status: string;
  lines: LineAnalysisRow[];
  materials: MaterialNeedRow[];
  totalRevenueCents: number;
  totalMaterialCostCents: number;
  totalLaborCostCents: number;
  totalOverheadCostCents: number;
  totalProductionCostCents: number;
  totalExpectedProfitCents: number;
  laborIsEstimated: boolean;
  overheadAllocationMethod: "kg" | "hours";
  overheadPeriodMonth: string;
  monthlyOverheadCents: number;
  hasShortage: boolean;
  canStart: boolean;
}

export async function analyzeOrderProduction(
  db: Db,
  orderId: string,
): Promise<OrderProductionAnalysis | null> {
  return analyzeOrderProductionImpl(db, orderId);
}

/** Aynı istek içinde tekrarlayan sipariş analizlerini tekilleştirir (dashboard vb.). */
export const getOrderProductionAnalysis = cache(analyzeOrderProduction);

async function analyzeOrderProductionImpl(
  db: Db,
  orderId: string,
): Promise<OrderProductionAnalysis | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true } },
      items: {
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
                          category: true,
                          subcategory: true,
                          unitPriceCents: true,
                          isDailySupply: true,
                        },
                      },
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

  if (!order) return null;

  const laborInfo = await computeOrderLaborCost(db, orderId);
  const [hoursPerBatch, avgHourly, teamSize, finishedStockMap] = await Promise.all([
    getFactoryLaborHoursPerBatch(db),
    getAvgProductionHourlyRateCents(db),
    getFactoryCookTeamSize(db),
    getAvailableFinishedUnitsMap(
      db,
      order.items
        .filter((item) => item.product.flavorId && item.product.packagingId)
        .map((item) => ({
          flavorId: item.product.flavorId!,
          packagingId: item.product.packagingId!,
        })),
    ),
  ]);

  const materialNeeds = new Map<string, MaterialNeedAccumulator>();

  const lines: LineAnalysisRow[] = [];

  for (const item of order.items) {
    const product = item.product;
    const packaging = product.packaging;
    const recipe = product.recipe;

    const requiredUnits = item.quantityUnits;
    const requiredBoxes = item.quantityBoxes;
    const unitsPerBox = packaging?.unitsPerBox ?? 0;

    const stockUnits =
      product.flavorId && product.packagingId
        ? finishedStockMap.get(`${product.flavorId}:${product.packagingId}`) ?? 0
        : 0;

    const fromStockUnits = Math.min(requiredUnits, stockUnits);
    const toProduceUnits = Math.max(0, requiredUnits - fromStockUnits);
    const toProduceBoxes =
      unitsPerBox > 0
        ? Math.ceil(toProduceUnits / unitsPerBox)
        : Math.max(0, requiredBoxes - Math.floor(fromStockUnits / (unitsPerBox || 1)));

    let boxesPerBatchCount = 0;
    let batchesNeeded = 0;
    let materialCostCents = 0;
    let productionKg = 0;

    if (recipe && packaging && toProduceBoxes > 0) {
      boxesPerBatchCount = boxesPerBatch(recipe.yieldKg, packaging.netWeightG);
      batchesNeeded =
        boxesPerBatchCount > 0
          ? Math.ceil(toProduceBoxes / boxesPerBatchCount)
          : 1;

      const prices = new Map<string, number>();
      for (const ri of recipe.items) {
        if (ri.materialId && ri.material) {
          prices.set(ri.materialId, ri.material.unitPriceCents);
        }
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

      const packagingItems = recipe.items
        .filter((i) => i.itemType === "packaging" && i.packagingId === packaging.id)
        .map((i) => ({
          id: i.id,
          materialId: i.materialId,
          materialCode: i.material?.code ?? null,
          materialName: i.material?.name ?? null,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes,
          packagingId: packaging.id,
          subcategory: i.material?.subcategory ?? null,
          unitPriceCents: i.material?.unitPriceCents ?? 0,
          perBatch: isPerBatchItem(
            i.material?.subcategory ?? null,
            i.notes,
          ),
        }));

      const rawCostPerBatch = computeRawCostCents(rawItems, prices);
      const packagingCostPerBatch = computePackagingCostCents(
        packagingItems,
        boxesPerBatchCount,
      );
      materialCostCents = (rawCostPerBatch + packagingCostPerBatch) * batchesNeeded;
      productionKg =
        toProduceUnits > 0 && packaging.netWeightG > 0
          ? (toProduceUnits * packaging.netWeightG) / 1000
          : batchesNeeded * recipe.yieldKg;

      for (const ri of recipe.items.filter((i) => i.itemType === "raw")) {
        if (!ri.materialId || !ri.material) continue;
        const need = ri.quantity * batchesNeeded;
        accumulateMaterial(materialNeeds, ri.material, need);
      }

      // Hammadde tam parti üzerinden hesaplanır (kazan yarım pişirilemez), ancak
      // kutu/beşik/koli yalnızca siparişe paketlenecek adet kadar gerekir. Partiden
      // artan ürün paketlenmeden beklediği için bu ambalaj siparişi bloke etmemeli.
      for (const pi of recipe.items.filter(
        (i) => i.itemType === "packaging" && i.packagingId === packaging.id,
      )) {
        if (!pi.materialId || !pi.material) continue;
        const perBatch = isPerBatchItem(
          pi.material.subcategory,
          pi.notes,
        );
        const multiplier = perBatch ? batchesNeeded : toProduceBoxes;
        const need = pi.quantity * multiplier;
        accumulateMaterial(materialNeeds, pi.material, need);
      }
    }

    const revenueCents = item.totalCents;
    const laborCostCents = 0;
    const overheadCostCents = 0;
    const productionCostCents = materialCostCents + laborCostCents + overheadCostCents;
    const expectedProfitCents = revenueCents - productionCostCents;

    lines.push({
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      requiredUnits,
      requiredBoxes,
      stockUnits,
      fromStockUnits,
      toProduceUnits,
      toProduceBoxes,
      boxesPerBatch: boxesPerBatchCount,
      batchesNeeded,
      revenueCents,
      materialCostCents,
      laborCostCents,
      overheadCostCents,
      productionKg,
      productionCostCents,
      expectedProfitCents,
    });
  }

  // Sipariş düzeyindeki iskonto ve navlun satırlara dağıtılır; aksi hâlde
  // analizdeki gelir, sipariş ekranındaki toplamla tutmaz.
  applyOrderLevelAdjustment(
    lines,
    order.freightCents - order.discountCents,
  );

  const totalBatches = lines.reduce((s, l) => s + l.batchesNeeded, 0);
  if (laborInfo.assignmentCount > 0 && totalBatches > 0) {
    for (const line of lines) {
      const share = line.batchesNeeded / totalBatches;
      line.laborCostCents = Math.round(laborInfo.totalLaborCostCents * share);
      line.productionCostCents =
        line.materialCostCents + line.laborCostCents + line.overheadCostCents;
      line.expectedProfitCents = line.revenueCents - line.productionCostCents;
    }
    const allocated = lines.reduce((s, l) => s + l.laborCostCents, 0);
    const diff = laborInfo.totalLaborCostCents - allocated;
    if (diff !== 0 && lines.length > 0) {
      const last = lines[lines.length - 1];
      last.laborCostCents += diff;
      last.productionCostCents =
        last.materialCostCents + last.laborCostCents + last.overheadCostCents;
      last.expectedProfitCents = last.revenueCents - last.productionCostCents;
    }
  } else {
    for (const line of lines) {
      if (line.batchesNeeded > 0) {
        const estHours = line.batchesNeeded * hoursPerBatch * teamSize;
        line.laborCostCents = computeLaborCostCents(estHours, avgHourly);
        line.productionCostCents =
          line.materialCostCents + line.laborCostCents + line.overheadCostCents;
        line.expectedProfitCents = line.revenueCents - line.productionCostCents;
      }
    }
  }

  const lineWeightMap = new Map(
    lines.map((line) => [line.productId, line.productionKg]),
  );
  const overheadAllocation = await allocateOrderOverhead(db, orderId, lineWeightMap);

  for (const line of lines) {
    line.overheadCostCents =
      overheadAllocation.lineOverheadCents.get(line.productId) ?? 0;
    line.productionCostCents =
      line.materialCostCents + line.laborCostCents + line.overheadCostCents;
    line.expectedProfitCents = line.revenueCents - line.productionCostCents;
  }

  const availableQtyMap = await getAvailableQtyMap(
    db,
    [...materialNeeds.keys()],
  );

  const materials: MaterialNeedRow[] = [];
  for (const m of materialNeeds.values()) {
    // Kalite tarafından serbest bırakılmamış lotlar kullanılabilir sayılmaz.
    const availableQty = availableQtyMap.get(m.materialId) ?? 0;
    const shortageQty = Math.max(0, m.requiredQty - availableQty);

    materials.push({
      materialId: m.materialId,
      materialCode: m.code,
      materialName: m.name,
      unit: m.unit,
      category: m.category,
      requiredQty: roundQty(m.requiredQty),
      availableQty: roundQty(availableQty),
      shortageQty: roundQty(shortageQty),
      isShort: shortageQty > 0 && !m.isDailySupply && !m.isOverhead,
      isDailySupply: m.isDailySupply,
      isOverhead: m.isOverhead,
    });
  }

  const totalRevenueCents = lines.reduce((s, l) => s + l.revenueCents, 0);
  const totalMaterialCostCents = lines.reduce((s, l) => s + l.materialCostCents, 0);
  const totalLaborCostCents = lines.reduce((s, l) => s + l.laborCostCents, 0);
  const totalOverheadCostCents = lines.reduce((s, l) => s + l.overheadCostCents, 0);
  const totalProductionCostCents =
    totalMaterialCostCents + totalLaborCostCents + totalOverheadCostCents;
  const hasShortage = materials.some((m) => m.isShort);

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    customerName: order.customer.name,
    status: order.status,
    lines,
    materials,
    totalRevenueCents,
    totalMaterialCostCents,
    totalLaborCostCents,
    totalOverheadCostCents,
    totalProductionCostCents,
    totalExpectedProfitCents: totalRevenueCents - totalProductionCostCents,
    laborIsEstimated: laborInfo.isEstimated && laborInfo.assignmentCount === 0,
    overheadAllocationMethod: overheadAllocation.allocationMethod,
    overheadPeriodMonth: overheadAllocation.periodMonth,
    monthlyOverheadCents: overheadAllocation.monthlyOverheadCents,
    hasShortage,
    canStart: !hasShortage && order.status === "approved",
  };
}

/** İskonto/navlun farkını satır gelirlerine ciro ağırlığıyla paylaştırır. */
function applyOrderLevelAdjustment(
  lines: LineAnalysisRow[],
  adjustmentCents: number,
): void {
  if (adjustmentCents === 0 || lines.length === 0) return;

  const subtotal = lines.reduce((sum, l) => sum + l.revenueCents, 0);
  if (subtotal <= 0) {
    lines[lines.length - 1].revenueCents += adjustmentCents;
    return;
  }

  let allocated = 0;
  lines.forEach((line, index) => {
    const share =
      index === lines.length - 1
        ? adjustmentCents - allocated
        : Math.round((adjustmentCents * line.revenueCents) / subtotal);
    line.revenueCents += share;
    allocated += share;
  });
}

interface MaterialNeedAccumulator {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  requiredQty: number;
  isDailySupply: boolean;
  isOverhead: boolean;
}

function accumulateMaterial(
  map: Map<string, MaterialNeedAccumulator>,
  material: {
    id: string;
    code: string;
    name: string;
    unit: string;
    category: string;
    subcategory: string | null;
    isDailySupply: boolean;
  },
  qty: number,
) {
  const existing = map.get(material.id);
  if (existing) {
    existing.requiredQty += qty;
    return;
  }

  map.set(material.id, {
    materialId: material.id,
    code: material.code,
    name: material.name,
    unit: material.unit,
    category: material.category,
    requiredQty: qty,
    isDailySupply: material.isDailySupply,
    isOverhead: isOverheadMaterial(material.subcategory),
  });
}

function roundQty(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}
