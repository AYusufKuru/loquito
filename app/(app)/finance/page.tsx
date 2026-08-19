import { FinanceManager } from "@/components/finance/finance-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import {
  currentPeriodMonth,
  FIXED_EXPENSE_DEMO_MONTH,
} from "@/lib/finance/constants";
import {
  getMonthlyOverheadPool,
  getOverheadSummary,
} from "@/lib/finance/overhead";
import {
  listFixedExpenses,
  serializeFixedExpense,
} from "@/lib/finance/service";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function FinancePage() {
  const { permissions } = await requireModuleAccess("finance");

  const canCreate = hasPermission(permissions, "finance", "create");
  const canEdit = hasPermission(permissions, "finance", "edit");
  const canDelete = hasPermission(permissions, "finance", "delete");

  const initialMonth = FIXED_EXPENSE_DEMO_MONTH || currentPeriodMonth();
  const compareMonthA = "2026-01";
  const compareMonthB = initialMonth;

  const [expenses, totalCents, overheadSummary, customers] = await Promise.all([
    listFixedExpenses(prisma, initialMonth),
    getMonthlyOverheadPool(prisma, initialMonth),
    getOverheadSummary(prisma, initialMonth),
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const labels: Record<string, string> = {
    title: t("modules.finance.title"),
    description: t("finance.pageDesc"),
    paymentsTab: t("finance.paymentsTab"),
    statementsTab: t("finance.statementsTab"),
    receiptsTab: t("finance.receiptsTab"),
    expensesTab: t("finance.expensesTab"),
    comparisonTab: t("finance.comparisonTab"),
    allocationTab: t("finance.allocationTab"),
    expensesTitle: t("finance.expensesTitle"),
    expensesDesc: t("finance.expensesDesc"),
    periodMonth: t("finance.periodMonth"),
    category: t("finance.category"),
    amount: t("finance.amount"),
    name: t("finance.name"),
    notes: t("finance.notes"),
    isActive: t("finance.isActive"),
    inactive: t("finance.inactive"),
    addExpense: t("finance.addExpense"),
    newExpense: t("finance.newExpense"),
    totalMonthly: t("finance.totalMonthly"),
    itemCount: t("finance.itemCount"),
    save: t("finance.save"),
    create: t("finance.create"),
    delete: t("finance.delete"),
    saving: t("finance.saving"),
    saved: t("finance.saved"),
    created: t("finance.created"),
    deleted: t("finance.deleted"),
    saveError: t("finance.saveError"),
    deleteError: t("finance.deleteError"),
    connectionError: t("finance.connectionError"),
    noExpenses: t("finance.noExpenses"),
    copyFromPrev: t("finance.copyFromPrev"),
    copied: t("finance.copied"),
    copyError: t("finance.copyError"),
    refresh: t("finance.refresh"),
    loading: t("finance.loading"),
    loadError: t("finance.loadError"),
    comparisonTitle: t("finance.comparisonTitle"),
    comparisonDesc: t("finance.comparisonDesc"),
    compareMonthA: t("finance.compareMonthA"),
    compareMonthB: t("finance.compareMonthB"),
    difference: t("finance.difference"),
    changePercent: t("finance.changePercent"),
    allocationTitle: t("finance.allocationTitle"),
    allocationDesc: t("finance.allocationDesc"),
    methodKg: t("finance.methodKg"),
    methodHours: t("finance.methodHours"),
    monthlyOverhead: t("finance.monthlyOverhead"),
    monthlyDenominator: t("finance.monthlyDenominator"),
    costPerUnit: t("finance.costPerUnit"),
    methodSaved: t("finance.methodSaved"),
    methodError: t("finance.methodError"),
    perKg: t("finance.perKg"),
    perHour: t("finance.perHour"),
    status: t("hr.status"),
    paymentsTitle: t("finance.paymentsTitle"),
    paymentsDesc: t("finance.paymentsDesc"),
    overdueOnly: t("finance.overdueOnly"),
    recordPayment: t("finance.recordPayment"),
    orderNo: t("finance.orderNo"),
    selectOrder: t("finance.selectOrder"),
    customer: t("finance.customer"),
    expected: t("finance.expected"),
    paid: t("finance.paid"),
    remaining: t("finance.remaining"),
    dueDate: t("finance.dueDate"),
    markPaid: t("finance.markPaid"),
    paymentRecorded: t("finance.paymentRecorded"),
    amountRequired: t("finance.amountRequired"),
    method: t("finance.method"),
    methodTransfer: t("finance.methodTransfer"),
    methodPix: t("finance.methodPix"),
    reference: t("finance.reference"),
    status_pending: t("finance.statusPending"),
    status_partial: t("finance.statusPartial"),
    status_paid: t("finance.statusPaid"),
    status_overdue: t("finance.statusOverdue"),
    receiptsTitle: t("finance.receiptsTitle"),
    receiptsDesc: t("finance.receiptsDesc"),
    uploadReceipt: t("finance.uploadReceipt"),
    file: t("finance.file"),
    counterparty: t("finance.counterparty"),
    uploaded: t("finance.uploaded"),
    uploadError: t("finance.uploadError"),
    noReceipts: t("finance.noReceipts"),
    matched: t("finance.matched"),
    unmatched: t("finance.unmatched"),
    download: t("finance.download"),
    statementTitle: t("finance.statementTitle"),
    statementDesc: t("finance.statementDesc"),
    loadStatement: t("finance.loadStatement"),
    totalDebit: t("finance.totalDebit"),
    totalCredit: t("finance.totalCredit"),
    balance: t("finance.balance"),
    debit: t("finance.debit"),
    credit: t("finance.credit"),
    descriptionCol: t("finance.descriptionCol"),
    exportPdf: t("finance.exportPdf"),
    date: t("finance.date"),
    matchingTab: t("finance.matchingTab"),
    matchingTitle: t("finance.matchingTitle"),
    matchingDesc: t("finance.matchingDesc"),
    uploadStatement: t("finance.uploadStatement"),
    statementUploaded: t("finance.statementUploaded"),
    loadDemo: t("finance.loadDemo"),
    demoLoaded: t("finance.demoLoaded"),
    statementsTitle: t("finance.statementsTitle"),
    lines: t("finance.lines"),
    approved: t("finance.approved"),
    pendingTitle: t("finance.pendingTitle"),
    pendingDesc: t("finance.pendingDesc"),
    noPending: t("finance.noPending"),
    direction: t("finance.direction"),
    directionIn: t("finance.directionIn"),
    directionOut: t("finance.directionOut"),
    match: t("finance.match"),
    approve: t("finance.approve"),
    approveSelected: t("finance.approveSelected"),
    approvedCount: t("finance.approvedCount"),
    approveError: t("finance.approveError"),
    reviewTitle: t("finance.reviewTitle"),
    reviewDesc: t("finance.reviewDesc"),
    reviewBadge: t("finance.reviewBadge"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <FinanceManager
        initialMonth={initialMonth}
        initialExpenses={expenses.map(serializeFixedExpense)}
        initialTotalCents={totalCents}
        initialOverheadSummary={overheadSummary}
        compareMonthA={compareMonthA}
        compareMonthB={compareMonthB}
        customers={customers}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        labels={labels}
      />
    </div>
  );
}
