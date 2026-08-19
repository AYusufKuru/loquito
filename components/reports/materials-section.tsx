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
import type { MaterialConsumptionReport } from "@/lib/reports/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

import {
  buildReportQuery,
  defaultReportFilter,
  ReportPeriodFilter,
  type ReportFilterState,
} from "./report-period-filter";

interface MaterialsSectionProps {
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

export function MaterialsSection({ initialMonth, labels }: MaterialsSectionProps) {
  const [filter, setFilter] = useState<ReportFilterState>(
    defaultReportFilter(initialMonth),
  );
  const [report, setReport] = useState<MaterialConsumptionReport | null>(null);
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
      const res = await apiFetch(`/api/reports/materials?${q}`);
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

  function exportCsv() {
    if (!applyValidationErrors(validateReportFilter(filter, filterLabels(labels)))) {
      return;
    }
    window.open(
      `/api/reports/export?${buildReportQuery(filter)}&type=materials&format=csv`,
      "_blank",
    );
  }

  return (
    <>
      {ErrorModal}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.materialsTitle}</CardTitle>
          <CardDescription>{labels.materialsDesc}</CardDescription>
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
            <Button variant="outline" onClick={exportCsv}>
              {labels.exportExcel}
            </Button>
          )}

          {report && (
            <>
              <p className="text-sm">
                {labels.totalCost}:{" "}
                <span className="font-semibold">
                  {formatBrlFromCents(report.totalCostCents)}
                </span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-2">{labels.materialCode}</th>
                      <th className="px-3 py-2">{labels.materialName}</th>
                      <th className="px-3 py-2">{labels.category}</th>
                      <th className="px-3 py-2">{labels.quantity}</th>
                      <th className="px-3 py-2">{labels.cost}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.materialId} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{row.materialCode}</td>
                        <td className="px-3 py-2">{row.materialName}</td>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">
                          {row.quantity} {row.unit}
                        </td>
                        <td className="px-3 py-2">{formatBrlFromCents(row.costCents)}</td>
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
