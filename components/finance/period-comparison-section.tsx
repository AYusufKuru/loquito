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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validatePeriodMonth } from "@/lib/forms/finance-validation";
import type { PeriodExpenseSummary } from "@/lib/finance/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface PeriodComparisonSectionProps {
  initialMonthA: string;
  initialMonthB: string;
  labels: Record<string, string>;
}

export function PeriodComparisonSection({
  initialMonthA,
  initialMonthB,
  labels,
}: PeriodComparisonSectionProps) {
  const [monthA, setMonthA] = useState(initialMonthA);
  const [monthB, setMonthB] = useState(initialMonthB);
  const [summaries, setSummaries] = useState<PeriodExpenseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    clearErrors,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const load = useCallback(async () => {
    if (
      !applyValidationErrors(validatePeriodMonth(monthA, labels.compareMonthA)) ||
      !applyValidationErrors(validatePeriodMonth(monthB, labels.compareMonthB))
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(
        `/api/finance/overhead?compareA=${monthA}&compareB=${monthB}`,
      );
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setSummaries(data.summaries ?? []);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [monthA, monthB, clearErrors, labels.compareMonthA, labels.compareMonthB, labels.connectionError, labels.loadError, showApiError, showError, applyValidationErrors]);

  useEffect(() => {
    load();
  }, [load]);

  const a = summaries.find((s) => s.periodMonth === monthA);
  const b = summaries.find((s) => s.periodMonth === monthB);
  const diff = (b?.totalCents ?? 0) - (a?.totalCents ?? 0);
  const pct =
    a && a.totalCents > 0
      ? ((diff / a.totalCents) * 100).toFixed(1)
      : "—";

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.comparisonTitle}</CardTitle>
        <CardDescription>{labels.comparisonDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>{labels.compareMonthA}</Label>
            <Input
              type="month"
              className="mt-1 w-40"
              value={monthA}
              onChange={(e) => setMonthA(e.target.value)}
            />
          </div>
          <div>
            <Label>{labels.compareMonthB}</Label>
            <Input
              type="month"
              className="mt-1 w-40"
              value={monthB}
              onChange={(e) => setMonthB(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {labels.refresh}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground">{monthA}</p>
            <p className="text-xl font-semibold">
              {formatBrlFromCents(a?.totalCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {a?.itemCount ?? 0} {labels.itemCount}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground">{monthB}</p>
            <p className="text-xl font-semibold">
              {formatBrlFromCents(b?.totalCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {b?.itemCount ?? 0} {labels.itemCount}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground">{labels.difference}</p>
            <p className="text-xl font-semibold">{formatBrlFromCents(diff)}</p>
            <p className="text-xs text-muted-foreground">
              {labels.changePercent}: {pct}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
