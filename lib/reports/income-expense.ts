import type { PrismaClient } from "@prisma/client";

import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import { getMonthlyOverheadPool } from "@/lib/finance/overhead";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orders/constants";
import { getOrderProductionAnalysis } from "@/lib/orders/production-analysis";

import type { DateRange } from "./constants";
import { monthsInRange } from "./constants";
import type { IncomeExpenseReport, IncomeExpensePoint } from "./types";
import { buildScrapCostTotal } from "./scrap";

type Db = PrismaClient;

export async function buildIncomeExpenseReport(
  db: Db,
  range: DateRange,
): Promise<IncomeExpenseReport> {
  return cachedQuery(
    ["income-expense", range.label, range.start.toISOString(), range.end.toISOString()],
    () => buildIncomeExpenseReportUncached(db, range),
    REVALIDATE.reports,
    ["reports"],
  );
}

async function buildIncomeExpenseReportUncached(
  db: Db,
  range: DateRange,
): Promise<IncomeExpenseReport> {
  const months = monthsInRange(range);
  const points: IncomeExpensePoint[] = [];

  for (const periodMonth of months) {
    const [year, month] = periodMonth.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const orders = await db.order.findMany({
      where: {
        status: { in: [...ACTIVE_ORDER_STATUSES] },
        orderDate: { gte: start, lte: end },
      },
      select: { id: true },
    });

    let revenueCents = 0;
    let productionCostCents = 0;

    for (const order of orders) {
      const analysis = await getOrderProductionAnalysis(db, order.id);
      if (!analysis) continue;
      revenueCents += analysis.totalRevenueCents;
      // Yalnızca değişken malzeme maliyeti. İşçilik ("Maaşlar") ve dağıtılmış
      // genel gider, aşağıdaki aylık sabit gider havuzunun içindedir; buraya
      // eklenirse kârdan iki kez düşülürler.
      productionCostCents += analysis.totalMaterialCostCents;
    }

    const fixedExpenseCents = await getMonthlyOverheadPool(db, periodMonth);
    const scrapCostCents = await buildScrapCostTotal(db, {
      start,
      end,
      label: periodMonth,
    });

    points.push({
      periodMonth,
      revenueCents,
      productionCostCents,
      fixedExpenseCents,
      scrapCostCents,
      profitCents: revenueCents - productionCostCents - fixedExpenseCents - scrapCostCents,
    });
  }

  return {
    rangeLabel: range.label,
    points,
  };
}
