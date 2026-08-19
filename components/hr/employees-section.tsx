"use client";

import { useCallback, useMemo, useState } from "react";

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
import { validateEmployeeForm } from "@/lib/forms/hr-validation";
import {
  sanitizeDecimalInput,
  sanitizeMoneyInput,
} from "@/lib/forms/validation";
import { EMPLOYEE_ROLES, EMPLOYEE_SHIFTS } from "@/lib/hr/constants";
import type { EmployeeRow, EmployeeSummary } from "@/lib/hr/types";
import {
  formatBrlFromCents,
  parseBrlToCents,
} from "@/lib/stock/constants";

interface EmployeesSectionProps {
  initialEmployees: EmployeeRow[];
  initialSummary: EmployeeSummary;
  canCreate: boolean;
  canEdit: boolean;
  labels: Record<string, string>;
}

function emptyForm() {
  return {
    name: "",
    role: EMPLOYEE_ROLES[0] as string,
    monthlySalary: "",
    hourlyRate: "",
    overtimeMultiplier: "1.5",
    shift: EMPLOYEE_SHIFTS[0].value as string,
    startDate: "",
    phone: "",
    email: "",
    isActive: true,
  };
}

export function EmployeesSection({
  initialEmployees,
  initialSummary,
  canCreate,
  canEdit,
  labels,
}: EmployeesSectionProps) {
  const [employees, setEmployees] = useLiveState(initialEmployees);
  const [summary, setSummary] = useLiveState(initialSummary);
  const [selectedId, setSelectedId] = useState(initialEmployees[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.role?.toLowerCase().includes(q) ?? false),
    );
  }, [employees, search]);

  const loadList = useCallback(async () => {
    const res = await apiFetch("/api/hr/employees");
    const data = await res.json();
    if (res.ok) {
      setEmployees(data.employees);
      setSummary(data.summary);
    }
  }, []);

  const loadDetail = useCallback((emp: EmployeeRow) => {
    setSelectedId(emp.id);
    setIsCreating(false);
    setForm({
      name: emp.name,
      role: emp.role ?? EMPLOYEE_ROLES[0],
      monthlySalary: formatBrlFromCents(emp.monthlySalaryCents).replace("R$", "").trim(),
      hourlyRate: formatBrlFromCents(emp.hourlyRateCents).replace("R$", "").trim(),
      overtimeMultiplier: String(emp.overtimeMultiplier),
      shift: emp.shift ?? EMPLOYEE_SHIFTS[0].value,
      startDate: emp.startDate ?? "",
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      isActive: emp.isActive,
    });
  }, []);

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedId("");
    setForm(emptyForm());
    setMessage("");
    clearErrors();
  };

  const handleSave = async () => {
    if (!applyValidationErrors(validateEmployeeForm(form))) return;

    setLoading(true);
    setMessage("");
    clearErrors();

    const monthlySalaryCents = parseBrlToCents(form.monthlySalary);
    if (monthlySalaryCents === null) return;

    const hourlyParsed = parseBrlToCents(form.hourlyRate);
    const payload = {
      name: form.name,
      role: form.role,
      monthlySalaryCents,
      hourlyRateCents: hourlyParsed ?? undefined,
      overtimeMultiplier: Number(form.overtimeMultiplier) || 1.5,
      shift: form.shift,
      startDate: form.startDate || null,
      phone: form.phone || null,
      email: form.email || null,
      isActive: form.isActive,
    };

    try {
      const url = isCreating ? "/api/hr/employees" : `/api/hr/employees/${selectedId}`;
      const method = isCreating ? "POST" : "PATCH";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setMessage(isCreating ? labels.created : labels.saved);
      await loadList();
      if (data.employee) loadDetail(data.employee);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {ErrorModal}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.summaryTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">{labels.activeCount}</p>
              <p className="text-lg font-semibold">{summary.activeCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.totalCount}</p>
              <p className="text-lg font-semibold">{summary.totalCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.totalSalary}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(summary.totalMonthlySalaryCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{labels.listTitle}</CardTitle>
            {canCreate && (
              <Button size="sm" variant="outline" onClick={handleCreate}>
                + {labels.newEmployee}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder={labels.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => loadDetail(emp)}
                  className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/50 ${
                    selectedId === emp.id && !isCreating ? "border-primary bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{emp.name}</span>
                    {!emp.isActive && (
                      <Badge variant="secondary">{labels.inactive}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {emp.role ?? "—"} · {formatBrlFromCents(emp.monthlySalaryCents)}
                  </p>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">{labels.noEmployees}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isCreating ? labels.newEmployee : labels.detailTitle}
          </CardTitle>
          <CardDescription>{labels.detailDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isCreating || selectedId) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={labels.name} error={fieldError("name")} required className="sm:col-span-2">
                  <Input
                    className="mt-1"
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      clearFieldError("name");
                    }}
                    disabled={!canEdit && !isCreating}
                  />
                </FormField>
                <div>
                  <Label>{labels.role}</Label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    disabled={!canEdit && !isCreating}
                  >
                    {EMPLOYEE_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{labels.shift}</Label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.shift}
                    onChange={(e) => setForm({ ...form, shift: e.target.value })}
                    disabled={!canEdit && !isCreating}
                  >
                    {EMPLOYEE_SHIFTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <FormField label={labels.monthlySalary} error={fieldError("monthlySalary")} required>
                  <Input
                    className="mt-1"
                    value={form.monthlySalary}
                    onChange={(e) => {
                      setForm({ ...form, monthlySalary: sanitizeMoneyInput(e.target.value) });
                      clearFieldError("monthlySalary");
                    }}
                    disabled={!canEdit && !isCreating}
                    placeholder="2.000,00"
                  />
                </FormField>
                <FormField label={labels.hourlyRate} error={fieldError("hourlyRate")}>
                  <Input
                    className="mt-1"
                    value={form.hourlyRate}
                    onChange={(e) => {
                      setForm({ ...form, hourlyRate: sanitizeMoneyInput(e.target.value) });
                      clearFieldError("hourlyRate");
                    }}
                    disabled={!canEdit && !isCreating}
                    placeholder={labels.hourlyAuto}
                  />
                </FormField>
                <FormField label={labels.overtimeMultiplier} error={fieldError("overtimeMultiplier")}>
                  <Input
                    className="mt-1"
                    value={form.overtimeMultiplier}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        overtimeMultiplier: sanitizeDecimalInput(e.target.value),
                      });
                      clearFieldError("overtimeMultiplier");
                    }}
                    disabled={!canEdit && !isCreating}
                  />
                </FormField>
                <div>
                  <Label>{labels.startDate}</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    disabled={!canEdit && !isCreating}
                  />
                </div>
                <div>
                  <Label>{labels.phone}</Label>
                  <Input
                    className="mt-1"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    disabled={!canEdit && !isCreating}
                  />
                </div>
                <FormField label={labels.email} error={fieldError("email")}>
                  <Input
                    className="mt-1"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      clearFieldError("email");
                    }}
                    disabled={!canEdit && !isCreating}
                  />
                </FormField>
                {!isCreating && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      disabled={!canEdit}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <Label>{labels.isActive}</Label>
                  </div>
                )}
              </div>

              {(canCreate && isCreating) || (canEdit && !isCreating) ? (
                <Button onClick={handleSave} disabled={loading}>
                  {loading
                    ? labels.saving
                    : isCreating
                      ? labels.create
                      : labels.save}
                </Button>
              ) : null}
            </>
          )}

          {!isCreating && !selectedId && (
            <p className="text-sm text-muted-foreground">{labels.selectEmployee}</p>
          )}

          {message && <p className="text-sm text-green-600">{message}</p>}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
