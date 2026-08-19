"use client";

import { apiFetch } from "@/lib/http";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateReportFilter } from "@/lib/forms/reports-validation";
import { REPORT_GROUP_BY } from "@/lib/reports/constants";
import type { ProfitabilityReport } from "@/lib/reports/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

import {
  buildReportQuery,
  defaultReportFilter,
  ReportPeriodFilter,
  type ReportFilterState,
} from "./report-period-filter";

interface ProfitabilitySectionProps {
  initialMonth: string;
  labels: Record<string, string>;
}

export function ProfitabilitySection({
  initialMonth,
  labels,
}: ProfitabilitySectionProps) {
  const [filter, setFilter] = useState<ReportFilterState>(
    defaultReportFilter(initialMonth),
  );
  const [groupBy, setGroupBy] = useState("customer");
  const [report, setReport] = useState<ProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const load = useCallback(async () => {
    if (
      !applyValidationErrors(
        validateReportFilter(filter, {
          fromDate: labels.fromDate,
          toDate: labels.toDate,
          periodMonth: labels.periodMonth,
          anchorDate: labels.anchorDate,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const q = buildReportQuery(filter, { groupBy });
      const res = await apiFetch(`/api/reports/profitability?${q}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setReport(data.report);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [
    filter,
    groupBy,
    labels.fromDate,
    labels.toDate,
    labels.periodMonth,
    labels.anchorDate,
    labels.connectionError,
    labels.loadError,
    clearErrors,
    showApiError,
    showError,
    applyValidationErrors,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (
      !applyValidationErrors(
        validateReportFilter(filter, {
          fromDate: labels.fromDate,
          toDate: labels.toDate,
          periodMonth: labels.periodMonth,
          anchorDate: labels.anchorDate,
        }),
      )
    ) {
      return;
    }
    const q = buildReportQuery(filter, { groupBy });
    window.open(`/api/reports/export?${q}&type=profitability&format=csv`, "_blank");
  }

  function printPdf() {
    window.print();
  }

  return (
    <>
      {ErrorModal}
      <Card className="print-area">
      <CardHeader>
        <CardTitle className="text-base">{labels.profitabilityTitle}</CardTitle>
        <CardDescription>{labels.profitabilityDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ReportPeriodFilter
          value={filter}
          onChange={setFilter}
          onApply={load}
          loading={loading}
          labels={labels}
          fieldError={fieldError}
          clearFieldError={clearFieldError}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>{labels.groupBy}</Label>
            <select
              className="mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              {REPORT_GROUP_BY.map((g) => (
                <option key={g.value} value={g.value}>
                  {labels[`group_${g.value}`] ?? g.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={load} disabled={loading}>{labels.refresh}</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!report}>
            {labels.exportExcel}
          </Button>
          <Button variant="outline" onClick={printPdf} disabled={!report}>
            {labels.exportPdf}
          </Button>
        </div>

        {report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">{labels.totalRevenue}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(report.summary.revenueCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.totalProdCost}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(report.summary.productionCostCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.totalProfit}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(report.summary.profitCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.margin}</p>
                <p className="text-lg font-semibold">{report.summary.marginPercent}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.fixedExpenses}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(report.summary.fixedExpenseCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.scrapCost}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(report.summary.scrapCostCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.orderCount}</p>
                <p className="text-lg font-semibold">{report.summary.orderCount}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {labels.rangeLabel}: {report.rangeLabel}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">{labels.groupColumn}</th>
                    <th className="px-3 py-2">{labels.revenue}</th>
                    <th className="px-3 py-2">{labels.materialCost}</th>
                    <th className="px-3 py-2">{labels.laborCost}</th>
                    <th className="px-3 py-2">{labels.overheadCost}</th>
                    <th className="px-3 py-2">{labels.prodCost}</th>
                    <th className="px-3 py-2">{labels.profit}</th>
                    <th className="px-3 py-2">{labels.margin}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.groupKey} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{row.groupLabel}</td>
                      <td className="px-3 py-2">{formatBrlFromCents(row.revenueCents)}</td>
                      <td className="px-3 py-2">{formatBrlFromCents(row.materialCostCents)}</td>
                      <td className="px-3 py-2">{formatBrlFromCents(row.laborCostCents)}</td>
                      <td className="px-3 py-2">{formatBrlFromCents(row.overheadCostCents)}</td>
                      <td className="px-3 py-2">{formatBrlFromCents(row.productionCostCents)}</td>
                      <td className="px-3 py-2 font-medium">
                        {formatBrlFromCents(row.profitCents)}
                      </td>
                      <td className="px-3 py-2">{row.marginPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </>
  );
}
