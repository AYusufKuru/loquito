"use client";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/reports/constants";

export interface ReportFilterState {
  period: ReportPeriod;
  date: string;
  from: string;
  to: string;
}

interface ReportPeriodFilterProps {
  value: ReportFilterState;
  onChange: (value: ReportFilterState) => void;
  onApply: () => void;
  loading?: boolean;
  labels: Record<string, string>;
  fieldError?: (field: string) => string | undefined;
  clearFieldError?: (field: string) => void;
}

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultReportFilter(month?: string): ReportFilterState {
  const m = month ?? "2026-02";
  return {
    period: "month",
    date: m,
    from: `${m}-01`,
    to: `${m}-28`,
  };
}

export function buildReportQuery(filter: ReportFilterState, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    period: filter.period,
    ...extra,
  });
  if (filter.period === "custom") {
    params.set("from", filter.from);
    params.set("to", filter.to);
  } else if (filter.period === "month" || filter.period === "year") {
    params.set("date", filter.date.length === 7 ? `${filter.date}-01` : filter.date);
  } else {
    params.set("date", filter.date);
  }
  return params.toString();
}

export function ReportPeriodFilter({
  value,
  onChange,
  onApply,
  loading,
  labels,
  fieldError,
  clearFieldError,
}: ReportPeriodFilterProps) {
  const err = fieldError ?? (() => undefined);
  const clear = clearFieldError ?? (() => {});

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField label={labels.periodType}>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={value.period}
          onChange={(e) =>
            onChange({
              ...value,
              period: e.target.value as ReportPeriod,
              date:
                e.target.value === "month" || e.target.value === "year"
                  ? defaultMonth()
                  : defaultDate(),
            })
          }
        >
          {REPORT_PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {labels[`period_${p.value}`] ?? p.label}
            </option>
          ))}
        </select>
      </FormField>

      {value.period === "custom" ? (
        <>
          <FormField
            label={labels.fromDate}
            error={err("from")}
            required
            className="w-40"
          >
            <Input
              type="date"
              value={value.from}
              onChange={(e) => {
                onChange({ ...value, from: e.target.value });
                clear("from");
                clear("to");
              }}
            />
          </FormField>
          <FormField
            label={labels.toDate}
            error={err("to")}
            required
            className="w-40"
          >
            <Input
              type="date"
              value={value.to}
              onChange={(e) => {
                onChange({ ...value, to: e.target.value });
                clear("to");
              }}
            />
          </FormField>
        </>
      ) : value.period === "month" || value.period === "year" ? (
        <FormField
          label={labels.periodMonth}
          error={err("date")}
          required
          className="w-40"
        >
          <Input
            type="month"
            value={value.date.slice(0, 7)}
            onChange={(e) => {
              onChange({ ...value, date: e.target.value });
              clear("date");
            }}
          />
        </FormField>
      ) : (
        <FormField
          label={labels.anchorDate}
          error={err("date")}
          required
          className="w-40"
        >
          <Input
            type="date"
            value={value.date}
            onChange={(e) => {
              onChange({ ...value, date: e.target.value });
              clear("date");
            }}
          />
        </FormField>
      )}

      <Button variant="outline" onClick={onApply} disabled={loading}>
        {labels.applyFilter}
      </Button>
    </div>
  );
}
