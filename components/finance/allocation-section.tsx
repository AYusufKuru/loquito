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
import { OVERHEAD_ALLOCATION_METHODS } from "@/lib/finance/constants";
import type { OverheadSummary } from "@/lib/finance/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface AllocationSectionProps {
  initialMonth: string;
  initialSummary: OverheadSummary | null;
  canEdit: boolean;
  labels: Record<string, string>;
}

export function AllocationSection({
  initialMonth,
  initialSummary,
  canEdit,
  labels,
}: AllocationSectionProps) {
  const [month, setMonth] = useState(initialMonth);
  const [summary, setSummary] = useState<OverheadSummary | null>(initialSummary);
  const [method, setMethod] = useState(
    initialSummary?.allocationMethod ?? "kg",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const {
    clearErrors,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const load = useCallback(async () => {
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/finance/overhead?month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setSummary(data.summary);
      setMethod(data.summary.allocationMethod);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [month, clearErrors, labels.connectionError, labels.loadError, showApiError, showError]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMethod() {
    if (!canEdit) return;
    if (!applyValidationErrors(validatePeriodMonth(month, labels.periodMonth))) return;

    setLoading(true);
    setMessage("");
    clearErrors();
    try {
      const res = await apiFetch("/api/finance/overhead", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, month }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.methodError);
        return;
      }
      setSummary(data.summary);
      setMessage(labels.methodSaved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  const unitLabel =
    summary?.allocationMethod === "hours" ? labels.perHour : labels.perKg;

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.allocationTitle}</CardTitle>
        <CardDescription>{labels.allocationDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>{labels.periodMonth}</Label>
            <Input
              type="month"
              className="mt-1 w-40"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {labels.refresh}
          </Button>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>{labels.allocationTitle}</Label>
              <select
                className="mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as "kg" | "hours")}
              >
                {OVERHEAD_ALLOCATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.value === "kg" ? labels.methodKg : labels.methodHours}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={saveMethod} disabled={loading}>
              {labels.save}
            </Button>
          </div>
        )}

        {message && <p className="text-sm text-green-600">{message}</p>}

        {summary && (
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground">{labels.monthlyOverhead}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(summary.monthlyOverheadCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.monthlyDenominator}</p>
              <p className="text-lg font-semibold">
                {summary.monthlyDenominator.toLocaleString("tr-TR")}{" "}
                {summary.denominatorLabel}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.costPerUnit}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(summary.costPerUnitCents)} {unitLabel}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Yöntem</p>
              <p className="text-lg font-semibold">
                {summary.allocationMethod === "kg"
                  ? labels.methodKg
                  : labels.methodHours}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
