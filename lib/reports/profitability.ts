import type { PrismaClient } from "@prisma/client";

import { getMonthlyOverheadPool } from "@/lib/finance/overhead";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orders/constants";
import { getOrderProductionAnalysis } from "@/lib/orders/production-analysis";

import type { DateRange, ReportGroupBy } from "./constants";
import { monthsInRange } from "./constants";
import type { ProfitabilityReport, ProfitabilityRow } from "./types";
import { buildScrapCostTotal } from "./scrap";

type Db = PrismaClient;

function marginPercent(revenue: number, profit: number): number {
  if (revenue <= 0) return 0;
  return Math.round((profit / revenue) * 1000) / 10;
}

function emptyRow(key: string, label: string): ProfitabilityRow {
  return {
    groupKey: key,
    groupLabel: label,
    revenueCents: 0,
    materialCostCents: 0,
    laborCostCents: 0,
    overheadCostCents: 0,
    productionCostCents: 0,
    profitCents: 0,
    marginPercent: 0,
    orderCount: 0,
  };
}

function accumulateRow(target: ProfitabilityRow, source: {
  revenueCents: number;
  materialCostCents: number;
  laborCostCents: number;
  overheadCostCents: number;
  productionCostCents: number;
  profitCents: number;
}, countOrder = false) {
  target.revenueCents += source.revenueCents;
  target.materialCostCents += source.materialCostCents;
  target.laborCostCents += source.laborCostCents;
  target.overheadCostCents += source.overheadCostCents;
  target.productionCostCents += source.productionCostCents;
  target.profitCents += source.profitCents;
  if (countOrder) target.orderCount += 1;
}

function finalizeRow(row: ProfitabilityRow) {
  row.marginPercent = marginPercent(row.revenueCents, row.profitCents);
}

export async function buildProfitabilityReport(
  db: Db,
  range: DateRange,
  groupBy: ReportGroupBy,
): Promise<ProfitabilityReport> {
  const orders = await db.order.findMany({
    where: {
      status: { in: [...ACTIVE_ORDER_STATUSES] },
      orderDate: { gte: range.start, lte: range.end },
    },
    include: {
      customer: { include: { salesRep: true } },
      items: {
        include: {
          product: {
            include: { flavor: true, packaging: true },
          },
        },
      },
    },
    orderBy: { orderDate: "asc" },
  });

  const map = new Map<string, ProfitabilityRow>();

  let totalRevenue = 0;
  let totalMaterial = 0;
  let totalLabor = 0;
  let totalOverhead = 0;
  let totalProduction = 0;
  let totalProfit = 0;

  for (const order of orders) {
    const analysis = await getOrderProductionAnalysis(db, order.id);
    if (!analysis) continue;

    totalRevenue += analysis.totalRevenueCents;
    totalMaterial += analysis.totalMaterialCostCents;
    totalLabor += analysis.totalLaborCostCents;
    totalOverhead += analysis.totalOverheadCostCents;
    totalProduction += analysis.totalProductionCostCents;
    totalProfit += analysis.totalExpectedProfitCents;

    if (groupBy === "order") {
      const key = order.id;
      const label = order.orderNo;
      const row = map.get(key) ?? emptyRow(key, label);
      accumulateRow(row, {
        revenueCents: analysis.totalRevenueCents,
        materialCostCents: analysis.totalMaterialCostCents,
        laborCostCents: analysis.totalLaborCostCents,
        overheadCostCents: analysis.totalOverheadCostCents,
        productionCostCents: analysis.totalProductionCostCents,
        profitCents: analysis.totalExpectedProfitCents,
      }, true);
      map.set(key, row);
      continue;
    }

    for (const line of analysis.lines) {
      const item = order.items.find((i) => i.productId === line.productId);
      const product = item?.product;

      let key = "";
      let label = "";

      switch (groupBy) {
        case "product":
          key = line.productId;
          label = `${line.productSku} — ${line.productName}`;
          break;
        case "flavor":
          key = product?.flavorId ?? "unknown";
          label =
            product?.flavor?.nameTr ??
            product?.flavor?.namePt ??
            "Bilinmeyen lezzet";
          break;
        case "packaging":
          key = product?.packagingId ?? "unknown";
          label = product?.packaging?.label ?? "Bilinmeyen gramaj";
          break;
        case "customer":
          key = order.customerId;
          label = order.customer.name;
          break;
        case "channel":
          key = order.channel ?? "unknown";
          label = channelLabel(order.channel);
          break;
        case "salesRep":
          key = order.customer.salesRepId ?? "none";
          label = order.customer.salesRep?.name ?? "Temsilci yok";
          break;
        default:
          key = line.productId;
          label = line.productSku;
      }

      const row = map.get(key) ?? emptyRow(key, label);
      accumulateRow(row, {
        revenueCents: line.revenueCents,
        materialCostCents: line.materialCostCents,
        laborCostCents: line.laborCostCents,
        overheadCostCents: line.overheadCostCents,
        productionCostCents: line.productionCostCents,
        profitCents: line.expectedProfitCents,
      });
      map.set(key, row);
    }
  }

  const rows = Array.from(map.values());
  for (const row of rows) finalizeRow(row);
  rows.sort((a, b) => b.revenueCents - a.revenueCents);

  const months = monthsInRange(range);
  let fixedExpenseCents = 0;
  for (const month of months) {
    fixedExpenseCents += await getMonthlyOverheadPool(db, month);
  }

  const scrapCostCents = await buildScrapCostTotal(db, range);

  return {
    rangeLabel: range.label,
    rangeFrom: range.start.toISOString(),
    rangeTo: range.end.toISOString(),
    groupBy,
    rows,
    summary: {
      revenueCents: totalRevenue,
      materialCostCents: totalMaterial,
      laborCostCents: totalLabor,
      overheadCostCents: totalOverhead,
      productionCostCents: totalProduction,
      profitCents: totalProfit,
      marginPercent: marginPercent(totalRevenue, totalProfit),
      fixedExpenseCents,
      scrapCostCents,
      orderCount: orders.length,
    },
  };
}

function channelLabel(channel: string | null): string {
  switch (channel) {
    case "retail_form":
      return "Matbu form";
    case "proposal":
      return "Teklif";
    case "portal":
      return "Portal";
    default:
      return channel ?? "—";
  }
}
