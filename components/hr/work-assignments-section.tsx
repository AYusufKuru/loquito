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
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateWorkAssignmentForm } from "@/lib/forms/hr-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import type { EmployeeRow, WorkAssignmentRow } from "@/lib/hr/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface WorkAssignmentsSectionProps {
  employees: EmployeeRow[];
  productionOrders: Array<{
    id: string;
    productionNo: string;
    orderNo: string | null;
    status: string;
  }>;
  canEdit: boolean;
  labels: Record<string, string>;
}

export function WorkAssignmentsSection({
  employees,
  productionOrders,
  canEdit,
  labels,
}: WorkAssignmentsSectionProps) {
  const [assignments, setAssignments] = useState<WorkAssignmentRow[]>([]);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [productionOrderId, setProductionOrderId] = useState(productionOrders[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("4");
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
    try {
      const res = await apiFetch("/api/hr/work-assignments");
      const data = await res.json();
      if (res.ok) setAssignments(data.assignments ?? []);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!canEdit) return;
    if (
      !applyValidationErrors(
        validateWorkAssignmentForm({
          employeeId,
          employeeLabel: labels.name,
          date,
          hours,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/hr/work-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          productionOrderId: productionOrderId || null,
          date,
          hours: Number(hours) || 0,
        }),
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
  };

  const totalLabor = assignments.reduce((s, a) => s + a.laborCostCents, 0);

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.assignmentsTitle}</CardTitle>
        <CardDescription>{labels.assignmentsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-md border p-4">
            <FormField label={labels.name} error={fieldError("employeeId")} required>
              <select
                className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  clearFieldError("employeeId");
                }}
              >
                {employees.filter((e) => e.isActive).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </FormField>
            <div>
              <Label>{labels.productionOrder}</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={productionOrderId}
                onChange={(e) => setProductionOrderId(e.target.value)}
              >
                <option value="">{labels.noProductionOrder}</option>
                {productionOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.productionNo} {o.orderNo ? `· ${o.orderNo}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <FormField label={labels.date} error={fieldError("date")} required>
              <Input
                type="date"
                className="mt-1"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  clearFieldError("date");
                }}
              />
            </FormField>
            <FormField label={labels.hours} error={fieldError("hours")} required>
              <Input
                className="mt-1"
                value={hours}
                onChange={(e) => {
                  setHours(sanitizeDecimalInput(e.target.value));
                  clearFieldError("hours");
                }}
              />
            </FormField>
            <div className="sm:col-span-2 flex items-end">
              <Button onClick={handleSave} disabled={loading}>{labels.saveAssignment}</Button>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {labels.totalLaborCost}: <span className="font-medium text-foreground">{formatBrlFromCents(totalLabor)}</span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2">{labels.date}</th>
                <th className="px-3 py-2">{labels.name}</th>
                <th className="px-3 py-2">{labels.productionOrder}</th>
                <th className="px-3 py-2">{labels.orderNo}</th>
                <th className="px-3 py-2">{labels.hours}</th>
                <th className="px-3 py-2">{labels.laborCost}</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{a.date}</td>
                  <td className="px-3 py-2">{a.employeeName}</td>
                  <td className="px-3 py-2">{a.productionNo ?? "—"}</td>
                  <td className="px-3 py-2">{a.orderNo ?? "—"}</td>
                  <td className="px-3 py-2">{a.hours}</td>
                  <td className="px-3 py-2">{formatBrlFromCents(a.laborCostCents)}</td>
                </tr>
              ))}
              {assignments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                    {labels.noAssignments}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {message && <p className="text-sm text-green-600">{message}</p>}
      </CardContent>
    </Card>
    </>
  );
}
