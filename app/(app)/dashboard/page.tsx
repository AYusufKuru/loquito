import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireModuleAccess } from "@/lib/auth/permissions";
import { getDashboardSnapshot } from "@/lib/dashboard/service";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export default async function DashboardPage() {
  await requireModuleAccess("dashboard");
  const data = await getDashboardSnapshot(prisma);

  const labels: Record<string, string> = {
    criticalAlerts: t("dashboard.criticalAlerts"),
    criticalAlertsDesc: t("dashboard.criticalAlertsDesc"),
    noAlerts: t("dashboard.noAlerts"),
    pendingApproval: t("dashboard.pendingApproval"),
    inProduction: t("dashboard.inProduction"),
    readyToShip: t("dashboard.readyToShip"),
    delayedOrders: t("dashboard.delayedOrders"),
    monthlyFinance: t("dashboard.monthlyFinance"),
    revenue: t("dashboard.revenue"),
    productionCost: t("dashboard.productionCost"),
    fixedExpenses: t("dashboard.fixedExpenses"),
    netProfit: t("dashboard.netProfit"),
    dailyProduction: t("dashboard.dailyProduction"),
    dailyProductionDesc: t("dashboard.dailyProductionDesc"),
    producedUnits: t("dashboard.producedUnits"),
    producedKg: t("dashboard.producedKg"),
    activeEmployees: t("dashboard.activeEmployees"),
    onAssignment: t("dashboard.onAssignment"),
    cookersTitle: t("dashboard.cookersTitle"),
    cookersDesc: t("dashboard.cookersDesc"),
    noActiveOrder: t("dashboard.noActiveOrder"),
    downtime: t("dashboard.downtime"),
    unitsShort: t("dashboard.unitsShort"),
    viewProduction: t("dashboard.viewProduction"),
    upcomingDeliveries: t("dashboard.upcomingDeliveries"),
    paymentDue: t("dashboard.paymentDue"),
    orderNo: t("dashboard.orderNo"),
    customer: t("dashboard.customer"),
    deliveryDate: t("dashboard.deliveryDate"),
    amount: t("dashboard.amount"),
    dueDate: t("dashboard.dueDate"),
    noItems: t("dashboard.noItems"),
    viewFinance: t("dashboard.viewFinance"),
    stockAlerts: t("dashboard.stockAlerts"),
    viewStock: t("dashboard.viewStock"),
    finishedStock: t("dashboard.finishedStock"),
    availableUnits: t("dashboard.availableUnits"),
    reservedUnits: t("dashboard.reservedUnits"),
    stockValue: t("dashboard.stockValue"),
    expiringSoon: t("dashboard.expiringSoon"),
    aiRecommendations: t("dashboard.aiRecommendations"),
    viewAi: t("dashboard.viewAi"),
    noAiRecommendations: t("dashboard.noAiRecommendations"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <DashboardView data={data} labels={labels} />
    </div>
  );
}
