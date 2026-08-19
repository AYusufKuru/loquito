"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import {
  validateFixedExpenseForm,
  validateExpenseAmount,
  validatePeriodMonth,
} from "@/lib/forms/finance-validation";
import { sanitizeMoneyInput } from "@/lib/forms/validation";
import { EXPENSE_CATEGORIES } from "@/lib/finance/constants";
import type { FixedExpenseRow } from "@/lib/finance/types";
import {
  formatBrlFromCents,
  parseBrlToCents,
} from "@/lib/stock/constants";

interface FixedExpensesSectionProps {
  initialMonth: string;
  initialExpenses: FixedExpenseRow[];
  initialTotalCents: number;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  labels: Record<string, string>;
}

function emptyForm() {
  return {
    name: "",
    amount: "",
    category: EXPENSE_CATEGORIES[0].value as string,
    notes: "",
    isActive: true,
  };
}

export function FixedExpensesSection({
  initialMonth,
  initialExpenses,
  initialTotalCents,
  canCreate,
  canEdit,
  canDelete,
  labels,
}: FixedExpensesSectionProps) {
  const [month, setMonth] = useState(initialMonth);
  const [expenses, setExpenses] = useLiveState(initialExpenses);
  const [totalCents, setTotalCents] = useLiveState(initialTotalCents);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
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
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/finance/fixed-expenses?month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setExpenses(data.expenses);
      setTotalCents(data.totalCents);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [month, labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [month]);

  async function handleCreate() {
    if (!canCreate) return;
    if (!applyValidationErrors(validateFixedExpenseForm(form))) return;
    if (!applyValidationErrors(validatePeriodMonth(month, labels.periodMonth))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/finance/fixed-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodMonth: month,
          name: form.name,
          amount: form.amount,
          category: form.category,
          notes: form.notes || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setMessage(labels.created);
      setIsCreating(false);
      setForm(emptyForm());
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(row: FixedExpenseRow, patch: Partial<FixedExpenseRow>) {
    if (!canEdit) return;
    setLoading(true);
    clearErrors();
    try {
      const body: Record<string, unknown> = { ...patch };
      const res = await apiFetch(`/api/finance/fixed-expenses/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setMessage(labels.saved);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canDelete) return;
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/finance/fixed-expenses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.deleteError);
        return;
      }
      setMessage(labels.deleted);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyFromPrev() {
    if (!canCreate) return;
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch("/api/finance/overhead", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy_month",
          fromMonth: prevMonth,
          toMonth: month,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.copyError);
        return;
      }
      setMessage(labels.copied);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.expensesTitle}</CardTitle>
        <CardDescription>{labels.expensesDesc}</CardDescription>
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
          {canCreate && (
            <>
              <Button variant="outline" onClick={handleCopyFromPrev} disabled={loading}>
                {labels.copyFromPrev}
              </Button>
              <Button
                onClick={() => {
                  setIsCreating(true);
                  setForm(emptyForm());
                }}
                disabled={loading}
              >
                {labels.addExpense}
              </Button>
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">{labels.totalMonthly}</p>
            <p className="text-lg font-semibold">{formatBrlFromCents(totalCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{labels.itemCount}</p>
            <p className="text-lg font-semibold">{expenses.length}</p>
          </div>
        </div>

        {message && <p className="text-sm text-green-600">{message}</p>}

        {isCreating && canCreate && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="font-medium text-sm">{labels.newExpense}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label={labels.name} error={fieldError("name")} required>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    clearFieldError("name");
                  }}
                />
              </FormField>
              <FormField label={labels.amount} error={fieldError("amount")} required>
                <Input
                  className="mt-1"
                  value={form.amount}
                  onChange={(e) => {
                    setForm({ ...form, amount: sanitizeMoneyInput(e.target.value) });
                    clearFieldError("amount");
                  }}
                />
              </FormField>
              <div>
                <Label>{labels.category}</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{labels.notes}</Label>
                <Input
                  className="mt-1"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={loading}>
                {labels.create}
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                İptal
              </Button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.noExpenses}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.name}</th>
                  <th className="px-3 py-2">{labels.category}</th>
                  <th className="px-3 py-2">{labels.amount}</th>
                  <th className="px-3 py-2">{labels.status}</th>
                  {canEdit && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.category ?? "—"}</td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <Input
                          className="h-8 w-28"
                          defaultValue={formatBrlFromCents(row.amountCents).replace(
                            "R$ ",
                            "",
                          )}
                          onBlur={(e) => {
                            if (!applyValidationErrors(validateExpenseAmount(e.target.value))) {
                              return;
                            }
                            const cents = parseBrlToCents(e.target.value);
                            if (cents != null && cents !== row.amountCents) {
                              handleUpdate(row, { amountCents: cents });
                            }
                          }}
                        />
                      ) : (
                        formatBrlFromCents(row.amountCents)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.isActive ? (
                        <Badge variant="secondary">{labels.isActive}</Badge>
                      ) : (
                        <Badge variant="outline">{labels.inactive}</Badge>
                      )}
                    </td>
                    {canDelete && (
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row.id)}
                          disabled={loading}
                        >
                          {labels.delete}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
