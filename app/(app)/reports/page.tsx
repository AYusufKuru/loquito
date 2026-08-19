import { ReportsManager } from "@/components/reports/reports-manager";
import { requireModuleAccess } from "@/lib/auth/permissions";
import { FIXED_EXPENSE_DEMO_MONTH } from "@/lib/finance/constants";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ReportsPage() {
  await requireModuleAccess("reports");

  const initialMonth = FIXED_EXPENSE_DEMO_MONTH;

  const labels: Record<string, string> = {
    title: t("modules.reports.title"),
    description: t("reports.pageDesc"),
    profitabilityTab: t("reports.profitabilityTab"),
    materialsTab: t("reports.materialsTab"),
    scrapTab: t("reports.scrapTab"),
    chartsTab: t("reports.chartsTab"),
    profitabilityTitle: t("reports.profitabilityTitle"),
    profitabilityDesc: t("reports.profitabilityDesc"),
    materialsTitle: t("reports.materialsTitle"),
    materialsDesc: t("reports.materialsDesc"),
    scrapTitle: t("reports.scrapTitle"),
    scrapDesc: t("reports.scrapDesc"),
    chartsTitle: t("reports.chartsTitle"),
    chartsDesc: t("reports.chartsDesc"),
    periodType: t("reports.periodType"),
    period_day: t("reports.periodDay"),
    period_week: t("reports.periodWeek"),
    period_month: t("reports.periodMonth"),
    period_year: t("reports.periodYear"),
    period_custom: t("reports.periodCustom"),
    periodMonth: t("reports.periodMonthLabel"),
    anchorDate: t("reports.anchorDate"),
    fromDate: t("reports.fromDate"),
    toDate: t("reports.toDate"),
    applyFilter: t("reports.applyFilter"),
    groupBy: t("reports.groupBy"),
    group_order: t("reports.groupOrder"),
    group_product: t("reports.groupProduct"),
    group_flavor: t("reports.groupFlavor"),
    group_packaging: t("reports.groupPackaging"),
    group_customer: t("reports.groupCustomer"),
    group_channel: t("reports.groupChannel"),
    group_salesRep: t("reports.groupSalesRep"),
    refresh: t("reports.refresh"),
    exportExcel: t("reports.exportExcel"),
    exportPdf: t("reports.exportPdf"),
    totalRevenue: t("reports.totalRevenue"),
    totalProdCost: t("reports.totalProdCost"),
    totalProfit: t("reports.totalProfit"),
    margin: t("reports.margin"),
    fixedExpenses: t("reports.fixedExpenses"),
    scrapCost: t("reports.scrapCost"),
    orderCount: t("reports.orderCount"),
    rangeLabel: t("reports.rangeLabel"),
    groupColumn: t("reports.groupColumn"),
    revenue: t("reports.revenue"),
    materialCost: t("reports.materialCost"),
    laborCost: t("reports.laborCost"),
    overheadCost: t("reports.overheadCost"),
    prodCost: t("reports.prodCost"),
    profit: t("reports.profit"),
    materialCode: t("reports.materialCode"),
    materialName: t("reports.materialName"),
    category: t("reports.category"),
    quantity: t("reports.quantity"),
    cost: t("reports.cost"),
    totalCost: t("reports.totalCost"),
    totalScrapKg: t("reports.totalScrapKg"),
    scrapKg: t("reports.scrapKg"),
    noScrap: t("reports.noScrap"),
    productionNo: t("reports.productionNo"),
    flavor: t("reports.flavor"),
    reason: t("reports.reason"),
    date: t("reports.date"),
    chartRevenue: t("reports.chartRevenue"),
    chartProdCost: t("reports.chartProdCost"),
    chartFixed: t("reports.chartFixed"),
    chartScrap: t("reports.chartScrap"),
    chartProfit: t("reports.chartProfit"),
    loadError: t("reports.loadError"),
    connectionError: t("reports.connectionError"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ReportsManager initialMonth={initialMonth} labels={labels} />
    </div>
  );
}
