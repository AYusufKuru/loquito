import type { PrismaClient } from "@prisma/client";

import type { DateRange } from "./constants";
import type { ScrapReport, ScrapRow } from "./types";

type Db = PrismaClient;

/** Tahmini fire maliyeti: kg × hammadde ortalama maliyet (R$ 2,55/kg şeker baz) */
const DEFAULT_SCRAP_COST_CENTS_PER_KG = 255;

/**
 * Reçete başına hammadde maliyetini (kuruş/kg) tek sorguda döner. Fire kaydı
 * başına reçete okumak, rapor maliyetini kayıt sayısıyla birlikte büyütüyordu.
 */
async function loadRecipeCostPerKg(
  db: Db,
  recipeIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(recipeIds)];
  const result = new Map<string, number>();
  if (unique.length === 0) return result;

  const recipes = await db.recipe.findMany({
    where: { id: { in: unique } },
    include: {
      items: {
        where: { itemType: "raw" },
        include: { material: { select: { unitPriceCents: true } } },
      },
    },
  });

  for (const recipe of recipes) {
    if (recipe.yieldKg <= 0) continue;
    let rawCost = 0;
    for (const item of recipe.items) {
      if (item.material) {
        rawCost += item.quantity * item.material.unitPriceCents;
      }
    }
    const perKg = Math.round(rawCost / recipe.yieldKg);
    if (perKg > 0) result.set(recipe.id, perKg);
  }

  return result;
}

function scrapCostCents(
  scrapKg: number,
  recipeId: string | null | undefined,
  costPerKg: Map<string, number>,
): number {
  if (scrapKg <= 0) return 0;
  const perKg =
    (recipeId ? costPerKg.get(recipeId) : undefined) ??
    DEFAULT_SCRAP_COST_CENTS_PER_KG;
  return Math.round(scrapKg * perKg);
}

export async function buildScrapCostTotal(db: Db, range: DateRange): Promise<number> {
  const report = await buildScrapReport(db, range);
  return report.totalCostCents;
}

export async function buildScrapReport(db: Db, range: DateRange): Promise<ScrapReport> {
  const scraps = await db.scrapRecord.findMany({
    where: {
      createdAt: { gte: range.start, lte: range.end },
    },
    include: {
      productionOrder: {
        include: {
          recipe: true,
          product: { include: { flavor: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const costPerKg = await loadRecipeCostPerKg(
    db,
    scraps
      .map((scrap) => scrap.productionOrder.recipeId)
      .filter((id): id is string => id != null),
  );

  const rows: ScrapRow[] = [];
  let totalKg = 0;
  let totalCostCents = 0;

  for (const scrap of scraps) {
    const po = scrap.productionOrder;
    const flavorName =
      po.product?.flavor?.nameTr ??
      po.product?.flavor?.namePt ??
      "—";
    const costCents = scrapCostCents(scrap.quantityKg, po.recipeId, costPerKg);

    totalKg += scrap.quantityKg;
    totalCostCents += costCents;

    rows.push({
      id: scrap.id,
      productionNo: po.productionNo,
      flavorName,
      quantityKg: scrap.quantityKg,
      reason: scrap.reason,
      costCents,
      date: scrap.createdAt.toISOString(),
    });
  }

  return {
    rangeLabel: range.label,
    rows,
    totalKg,
    totalCostCents,
  };
}
