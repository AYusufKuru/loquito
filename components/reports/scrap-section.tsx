"use client";

import { apiFetch } from "@/lib/http";

import { useCallback, useState } from "react";

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
import type { ScrapReport } from "@/lib/reports/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

import {
  buildReportQuery,
  defaultReportFilter,
  ReportPeriodFilter,
  type ReportFilterState,
} from "./report-period-filter";

interface ScrapSectionProps {
  initialMonth: string;
  labels: Record<string, string>;
}

function filterLabels(labels: Record<string, string>) {
  return {
    fromDate: labels.fromDate,
    toDate: labels.toDate,
    periodMonth: labels.periodMonth,
    anchorDate: labels.anchorDate,
  };
}

export function ScrapSection({ initialMonth, labels }: ScrapSectionProps) {
  const [filter, setFilter] = useState<ReportFilterState>(
    defaultReportFilter(initialMonth),
  );
  const [report, setReport] = useState<ScrapReport | null>(null);
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
      const res = await apiFetch(`/api/reports/scrap?${q}`);
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

  return (
    <>
      {ErrorModal}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.scrapTitle}</CardTitle>
          <CardDescription>{labels.scrapDesc}</CardDescription>
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

          {report && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">{labels.totalScrapKg}</p>
                  <p className="text-lg font-semibold">{report.totalKg} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{labels.scrapCost}</p>
                  <p className="text-lg font-semibold">
                    {formatBrlFromCents(report.totalCostCents)}
                  </p>
                </div>
              </div>
              {report.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{labels.noScrap}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-3 py-2">{labels.productionNo}</th>
                        <th className="px-3 py-2">{labels.flavor}</th>
                        <th className="px-3 py-2">{labels.scrapKg}</th>
                        <th className="px-3 py-2">{labels.reason}</th>
                        <th className="px-3 py-2">{labels.cost}</th>
                        <th className="px-3 py-2">{labels.date}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{row.productionNo}</td>
                          <td className="px-3 py-2">{row.flavorName}</td>
                          <td className="px-3 py-2">{row.quantityKg}</td>
                          <td className="px-3 py-2">{row.reason ?? "—"}</td>
                          <td className="px-3 py-2">{formatBrlFromCents(row.costCents)}</td>
                          <td className="px-3 py-2">{row.date.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
