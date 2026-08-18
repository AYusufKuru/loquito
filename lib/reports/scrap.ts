import type { PrismaClient } from "@prisma/client";

import type { DateRange } from "./constants";
import type { ScrapReport, ScrapRow } from "./types";

type Db = PrismaClient;

/** Tahmini fire maliyeti: kg × hammadde ortalama maliyet (R$ 2,55/kg şeker baz) */
const DEFAULT_SCRAP_COST_CENTS_PER_KG = 255;

export async function estimateScrapCostCents(
  db: Db,
  scrapKg: number,
  recipeId?: string | null,
): Promise<number> {
  if (scrapKg <= 0) return 0;

  if (recipeId) {
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        items: {
          where: { itemType: "raw" },
          include: { material: { select: { unitPriceCents: true } } },
        },
      },
    });
    if (recipe && recipe.yieldKg > 0) {
      let rawCost = 0;
      for (const item of recipe.items) {
        if (item.material) {
          rawCost += item.quantity * item.material.unitPriceCents;
        }
      }
      const perKg = Math.round(rawCost / recipe.yieldKg);
      if (perKg > 0) return Math.round(scrapKg * perKg);
    }
  }

  return Math.round(scrapKg * DEFAULT_SCRAP_COST_CENTS_PER_KG);
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

  const rows: ScrapRow[] = [];
  let totalKg = 0;
  let totalCostCents = 0;

  for (const scrap of scraps) {
    const po = scrap.productionOrder;
    const flavorName =
      po.product?.flavor?.nameTr ??
      po.product?.flavor?.namePt ??
      "—";
    const costCents = await estimateScrapCostCents(
      db,
      scrap.quantityKg,
      po.recipeId,
    );

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
