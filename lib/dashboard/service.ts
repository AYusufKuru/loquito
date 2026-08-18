import type { PrismaClient } from "@prisma/client";

import { buildAiRecommendations } from "@/lib/ai/recommendations/service";
import { cachedQuery, REVALIDATE, todayCacheKey } from "@/lib/cache/server";
import { computeFinishedStockSummary } from "@/lib/finished-stock/service";
import { FIXED_EXPENSE_DEMO_MONTH } from "@/lib/finance/constants";
import { listOrderPayments } from "@/lib/finance/payments";
import { buildIncomeExpenseReport } from "@/lib/reports/income-expense";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orders/constants";
import { getLiveProductionBoard } from "@/lib/production/live";
import { computeStockAlerts } from "@/lib/stock/inventory";

import type {
  DashboardAlert,
  DashboardSnapshot,
} from "./types";

type Db = PrismaClient;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export async function getDashboardSnapshot(db: Db): Promise<DashboardSnapshot> {
  return cachedQuery(
    ["dashboard-snapshot", todayCacheKey()],
    () => buildDashboardSnapshot(db),
    REVALIDATE.dashboard,
    ["dashboard"],
  );
}

async function buildDashboardSnapshot(db: Db): Promise<DashboardSnapshot> {
  const today = startOfToday();
  const todayEnd = endOfToday();
  const periodMonth = FIXED_EXPENSE_DEMO_MONTH;

  const [
    pendingApproval,
    inProduction,
    readyToShip,
    delayedOrders,
    upcomingDeliveries,
    liveBoard,
    stockAlertsRaw,
    finishedSummary,
    activeEmployees,
    presentToday,
    assignmentsToday,
    productionToday,
    incomeExpense,
    orderPayments,
    aiReport,
  ] = await Promise.all([
    db.order.count({ where: { status: "pending_approval" } }),
    db.order.count({ where: { status: "in_production" } }),
    db.order.count({ where: { status: "ready_ship" } }),
    db.order.count({
      where: {
        deliveryDate: { lt: today },
        status: { notIn: ["shipped", "cancelled", "draft"] },
      },
    }),
    db.order.findMany({
      where: {
        deliveryDate: { gte: today },
        status: { notIn: ["shipped", "cancelled", "draft"] },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { deliveryDate: "asc" },
      take: 8,
    }),
    getLiveProductionBoard(db),
    computeStockAlerts(),
    computeFinishedStockSummary(db),
    db.employee.count({ where: { isActive: true } }),
    db.attendance.count({
      where: {
        date: { gte: today, lte: todayEnd },
        status: { in: ["present", "overtime"] },
      },
    }),
    db.workAssignment.count({
      where: { date: { gte: today, lte: todayEnd } },
    }),
    db.productionOrder.aggregate({
      where: {
        OR: [
          { actualEnd: { gte: today, lte: todayEnd } },
          { status: "in_progress" },
        ],
      },
      _sum: { producedUnits: true, producedKg: true, currentKg: true },
    }),
    buildIncomeExpenseReport(db, {
      start: new Date(`${periodMonth}-01`),
      end: new Date(
        new Date(`${periodMonth}-01`).getFullYear(),
        new Date(`${periodMonth}-01`).getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
      label: periodMonth,
    }),
    listOrderPayments(db),
    buildAiRecommendations(db, { limit: 3 }),
  ]);

  const monthlyPoint = incomeExpense.points.find(
    (p) => p.periodMonth === periodMonth,
  );

  const overduePayments = orderPayments
    .filter((p) => p.status === "overdue")
    .map((p) => ({
      orderNo: p.orderNo,
      customerName: p.customerName,
      dueDate: p.dueDate?.slice(0, 10) ?? "",
      amountCents: p.remainingCents,
      daysUntilDue: p.daysUntilDue ?? 0,
    }));

  const upcomingPayments = orderPayments
    .filter(
      (p) =>
        p.status === "pending" &&
        p.daysUntilDue != null &&
        p.daysUntilDue >= 0 &&
        p.daysUntilDue <= 14,
    )
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0))
    .slice(0, 8)
    .map((p) => ({
      orderNo: p.orderNo,
      customerName: p.customerName,
      dueDate: p.dueDate?.slice(0, 10) ?? "",
      amountCents: p.remainingCents,
      daysUntilDue: p.daysUntilDue ?? 0,
    }));

  const stockAlerts: DashboardAlert[] = stockAlertsRaw.slice(0, 6).map((a) => ({
    type: a.type,
    message: a.message,
    severity:
      a.severity === "warning" ? "high" : ("medium" as const),
    href: "/stock",
  }));

  const criticalAlerts: DashboardAlert[] = [];

  if (overduePayments.length > 0) {
    criticalAlerts.push({
      type: "payment_overdue",
      message: `${overduePayments.length} geciken ödeme`,
      severity: "high",
      href: "/finance",
    });
  }

  if (delayedOrders > 0) {
    criticalAlerts.push({
      type: "delivery_delayed",
      message: `${delayedOrders} geciken teslimat`,
      severity: "high",
      href: "/orders",
    });
  }

  if (stockAlertsRaw.length > 0) {
    criticalAlerts.push({
      type: "stock_critical",
      message: `${stockAlertsRaw.length} kritik stok uyarısı`,
      severity: "medium",
      href: "/stock",
    });
  }

  if (finishedSummary.expiringSoonCount > 0) {
    criticalAlerts.push({
      type: "expiring_stock",
      message: `${finishedSummary.expiringSoonCount} mamul SKT yaklaşıyor`,
      severity: "medium",
      href: "/stock",
    });
  }

  const cookers = liveBoard.cookers.map((c) => ({
    lineCode: c.lineCode,
    lineName: c.lineName,
    status: c.lineStatus,
    statusLabel: c.lineStatusLabel,
    orderNo: c.activeOrder?.orderNo ?? null,
    stage: c.activeOrder?.currentStageLabel ?? null,
    progressPercent: c.activeOrder?.stageProgressPercent ?? 0,
    hasDowntime: c.activeDowntime != null,
  }));

  const mapLine = (
    line: NonNullable<typeof liveBoard.cuttingLine>,
  ) => ({
    lineCode: line.lineCode,
    lineName: line.lineName,
    status: line.lineStatus,
    dailyProducedUnits: line.dailyProducedUnits,
    dailyTargetUnits: line.dailyTargetUnits,
    progressPercent: line.progressPercent,
  });

  const producedKg =
    (productionToday._sum.producedKg ?? 0) +
    (productionToday._sum.currentKg ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    orderCounts: {
      pendingApproval,
      inProduction,
      readyToShip,
      delayed: delayedOrders,
    },
    upcomingDeliveries: upcomingDeliveries.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      customerName: o.customer.name,
      status: o.status,
      statusLabel:
        STATUS_LABELS[o.status as OrderStatus] ?? o.status,
      deliveryDate: o.deliveryDate?.toISOString() ?? null,
      totalCents: o.totalCents,
      daysUntilDelivery: o.deliveryDate
        ? daysBetween(today, o.deliveryDate)
        : null,
    })),
    overduePayments,
    upcomingPayments,
    monthlyFinance: {
      periodMonth,
      revenueCents: monthlyPoint?.revenueCents ?? 0,
      productionCostCents: monthlyPoint?.productionCostCents ?? 0,
      fixedExpenseCents: monthlyPoint?.fixedExpenseCents ?? 0,
      profitCents: monthlyPoint?.profitCents ?? 0,
    },
    cookers,
    cuttingLine: liveBoard.cuttingLine
      ? mapLine(liveBoard.cuttingLine)
      : null,
    packagingLine: liveBoard.packagingLine
      ? mapLine(liveBoard.packagingLine)
      : null,
    todayProducedUnits:
      (liveBoard.cuttingLine?.dailyProducedUnits ?? 0) +
      (liveBoard.packagingLine?.dailyProducedUnits ?? 0),
    todayProducedKg: Math.round(producedKg * 10) / 10,
    stockAlerts,
    finishedStock: {
      totalUnits: finishedSummary.totalUnits,
      availableUnits: finishedSummary.availableUnits,
      reservedUnits: finishedSummary.reservedUnits,
      totalValueCents: finishedSummary.totalValueCents,
      expiringSoonCount: finishedSummary.expiringSoonCount,
    },
    hr: {
      activeEmployees,
      presentToday,
      onAssignmentToday: assignmentsToday,
    },
    criticalAlerts,
    aiRecommendations: aiReport.recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      severity: r.severity,
      href: r.href,
    })),
  };
}
