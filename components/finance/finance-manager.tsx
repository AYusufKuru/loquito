"use client";

import { useState } from "react";

import { AllocationSection } from "@/components/finance/allocation-section";
import { FixedExpensesSection } from "@/components/finance/fixed-expenses-section";
import { PaymentsSection } from "@/components/finance/payments-section";
import { PeriodComparisonSection } from "@/components/finance/period-comparison-section";
import { ReceiptsSection } from "@/components/finance/receipts-section";
import { StatementMatchingSection } from "@/components/finance/statement-matching-section";
import { StatementsSection } from "@/components/finance/statements-section";
import { TaxLocationsSection } from "@/components/finance/tax-locations-section";
import { cn } from "@/lib/utils";
import type { FixedExpenseRow, OverheadSummary } from "@/lib/finance/types";
import type { TaxLocationRow } from "@/lib/finance/tax-locations";

type Tab =
  | "expenses"
  | "comparison"
  | "allocation"
  | "payments"
  | "matching"
  | "receipts"
  | "statements"
  | "tax";

interface FinanceManagerProps {
  initialMonth: string;
  initialExpenses: FixedExpenseRow[];
  initialTotalCents: number;
  initialOverheadSummary: OverheadSummary | null;
  compareMonthA: string;
  compareMonthB: string;
  customers: Array<{ id: string; name: string }>;
  initialTaxLocations: TaxLocationRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  labels: Record<string, string>;
}

export function FinanceManager({
  initialMonth,
  initialExpenses,
  initialTotalCents,
  initialOverheadSummary,
  compareMonthA,
  compareMonthB,
  customers,
  initialTaxLocations,
  canCreate,
  canEdit,
  canDelete,
  labels,
}: FinanceManagerProps) {
  const [tab, setTab] = useState<Tab>("payments");

  const tabs: { id: Tab; label: string }[] = [
    { id: "payments", label: labels.paymentsTab },
    { id: "tax", label: labels.taxLocationsTab },
    { id: "matching", label: labels.matchingTab },
    { id: "statements", label: labels.statementsTab },
    { id: "receipts", label: labels.receiptsTab },
    { id: "expenses", label: labels.expensesTab },
    { id: "comparison", label: labels.comparisonTab },
    { id: "allocation", label: labels.allocationTab },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "payments" && (
          <PaymentsSection
            canCreate={canCreate}
            canEdit={canEdit}
            labels={labels}
          />
        )}
        {tab === "tax" && (
          <TaxLocationsSection
            initialLocations={initialTaxLocations}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            labels={labels}
          />
        )}
        {tab === "matching" && (
          <StatementMatchingSection
            canCreate={canCreate}
            canEdit={canEdit}
            labels={labels}
          />
        )}
        {tab === "statements" && (
          <StatementsSection customers={customers} labels={labels} />
        )}
        {tab === "receipts" && (
          <ReceiptsSection canCreate={canCreate} labels={labels} />
        )}
        {tab === "expenses" && (
          <FixedExpensesSection
            initialMonth={initialMonth}
            initialExpenses={initialExpenses}
            initialTotalCents={initialTotalCents}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            labels={labels}
          />
        )}
        {tab === "comparison" && (
          <PeriodComparisonSection
            initialMonthA={compareMonthA}
            initialMonthB={compareMonthB}
            labels={labels}
          />
        )}
        {tab === "allocation" && (
          <AllocationSection
            initialMonth={initialMonth}
            initialSummary={initialOverheadSummary}
            canEdit={canEdit}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
