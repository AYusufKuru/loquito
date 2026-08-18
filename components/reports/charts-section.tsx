"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateReportFilter } from "@/lib/forms/reports-validation";
import type { IncomeExpenseReport } from "@/lib/reports/types";
import { formatBrlFromCents } from "@/lib/stock/constants";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildReportQuery,
  defaultReportFilter,
  ReportPeriodFilter,
  type ReportFilterState,
} from "./report-period-filter";

interface ChartsSectionProps {
  initialMonth: string;
  labels: Record<string, string>;
}

function centsToBrl(cents: number): number {
  return Math.round(cents) / 100;
}

function filterLabels(labels: Record<string, string>) {
  return {
    fromDate: labels.fromDate,
    toDate: labels.toDate,
    periodMonth: labels.periodMonth,
    anchorDate: labels.anchorDate,
  };
}

export function ChartsSection({ initialMonth, labels }: ChartsSectionProps) {
  const [filter, setFilter] = useState<ReportFilterState>(
    defaultReportFilter(initialMonth),
  );
  const [report, setReport] = useState<IncomeExpenseReport | null>(null);
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
    if (!applyValidationErrors(validateReportFilter(filter, filterLabels(labels)))) {
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const q = buildReportQuery(filter);
      const res = await fetch(`/api/reports/charts?${q}`);
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
  }, [filter, labels, clearErrors, showApiError, showError, applyValidationErrors]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData =
    report?.points.map((p) => ({
      month: p.periodMonth,
      gelir: centsToBrl(p.revenueCents),
      uretimMaliyeti: centsToBrl(p.productionCostCents),
      sabitGider: centsToBrl(p.fixedExpenseCents),
      fire: centsToBrl(p.scrapCostCents),
      kar: centsToBrl(p.profitCents),
    })) ?? [];

  return (
    <>
      {ErrorModal}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.chartsTitle}</CardTitle>
          <CardDescription>{labels.chartsDesc}</CardDescription>
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
          <Button variant="outline" onClick={load} disabled={loading}>
            {labels.refresh}
          </Button>

          {chartData.length > 0 && (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) =>
                      formatBrlFromCents(Number(value) * 100)
                    }
                  />
                  <Legend />
                  <Bar dataKey="gelir" name={labels.chartRevenue} fill="#16a34a" />
                  <Bar
                    dataKey="uretimMaliyeti"
                    name={labels.chartProdCost}
                    fill="#dc2626"
                  />
                  <Bar dataKey="sabitGider" name={labels.chartFixed} fill="#9333ea" />
                  <Bar dataKey="fire" name={labels.chartScrap} fill="#f59e0b" />
                  <Bar dataKey="kar" name={labels.chartProfit} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
