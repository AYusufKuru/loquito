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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validatePayrollMonth } from "@/lib/forms/hr-validation";
import type { PayrollSummary } from "@/lib/hr/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface PayrollSectionProps {
  labels: Record<string, string>;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollSection({ labels }: PayrollSectionProps) {
  const [month, setMonth] = useState(currentMonth());
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    clearErrors,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const load = useCallback(async () => {
    if (!applyValidationErrors(validatePayrollMonth(month, labels.payrollMonth))) {
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const res = await fetch(`/api/hr/payroll?month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setPayroll(data.payroll);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [month, clearErrors, labels.connectionError, labels.loadError, labels.payrollMonth, showApiError, showError, applyValidationErrors]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.payrollTitle}</CardTitle>
        <CardDescription>{labels.payrollDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>{labels.payrollMonth}</Label>
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

        {payroll && (
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground">{labels.workedHours}</p>
              <p className="text-lg font-semibold">{payroll.totalWorkedHours}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.overtimeHours}</p>
              <p className="text-lg font-semibold">{payroll.totalOvertimeHours}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.regularPay}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(payroll.totalRegularPayCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.totalPayroll}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(payroll.totalPayCents)}
              </p>
            </div>
          </div>
        )}

        {payroll && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.name}</th>
                  <th className="px-3 py-2">{labels.role}</th>
                  <th className="px-3 py-2">{labels.workedHours}</th>
                  <th className="px-3 py-2">{labels.overtimeHours}</th>
                  <th className="px-3 py-2">{labels.absentDays}</th>
                  <th className="px-3 py-2">{labels.leaveDays}</th>
                  <th className="px-3 py-2">{labels.totalPay}</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r) => (
                  <tr key={r.employeeId} className="border-b last:border-0">
                    <td className="px-3 py-2">{r.employeeName}</td>
                    <td className="px-3 py-2">{r.role ?? "—"}</td>
                    <td className="px-3 py-2">{r.workedHours}</td>
                    <td className="px-3 py-2">{r.overtimeHours}</td>
                    <td className="px-3 py-2">{r.absentDays}</td>
                    <td className="px-3 py-2">{r.leaveDays}</td>
                    <td className="px-3 py-2 font-medium">
                      {formatBrlFromCents(r.totalPayCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">{labels.loading}</p>}
      </CardContent>
    </Card>
    </>
  );
}
