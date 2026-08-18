"use client";

import { useCallback, useEffect, useState } from "react";

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
import { validateAttendanceForm } from "@/lib/forms/hr-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import { ATTENDANCE_STATUSES, DEFAULT_CLOCK_IN, DEFAULT_CLOCK_OUT } from "@/lib/hr/constants";
import type { AttendanceRow, EmployeeRow } from "@/lib/hr/types";

interface AttendanceSectionProps {
  employees: EmployeeRow[];
  canEdit: boolean;
  labels: Record<string, string>;
}

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function AttendanceSection({ employees, canEdit, labels }: AttendanceSectionProps) {
  const [from, setFrom] = useState(weekStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clockIn, setClockIn] = useState(DEFAULT_CLOCK_IN);
  const [clockOut, setClockOut] = useState(DEFAULT_CLOCK_OUT);
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [status, setStatus] = useState("present");
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
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/hr/attendance?${params}`);
      const data = await res.json();
      if (res.ok) setRows(data.attendance ?? []);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [from, to, labels.connectionError, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!canEdit || !selectedEmployeeId) return;
    if (
      !applyValidationErrors(
        validateAttendanceForm({
          employeeId: selectedEmployeeId,
          employeeLabel: labels.name,
          date,
          status,
          clockIn,
          clockOut,
          overtimeHours,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await fetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          date,
          clockIn: status === "present" ? clockIn : null,
          clockOut: status === "present" ? clockOut : null,
          overtimeHours: Number(overtimeHours) || 0,
          status,
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

  return (
    <>
      {ErrorModal}
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.attendanceTitle}</CardTitle>
          <CardDescription>{labels.attendanceDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>{labels.filterFrom}</Label>
              <Input type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>{labels.filterTo}</Label>
              <Input type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={load} disabled={loading}>{labels.refresh}</Button>
            </div>
          </div>

          {canEdit && (
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">{labels.addAttendance}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label={labels.name} error={fieldError("employeeId")} required>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      clearFieldError("employeeId");
                    }}
                  >
                    {employees.filter((e) => e.isActive).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </FormField>
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
                <div>
                  <Label>{labels.status}</Label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {ATTENDANCE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <FormField label={labels.overtimeHours} error={fieldError("overtimeHours")}>
                  <Input
                    className="mt-1"
                    value={overtimeHours}
                    onChange={(e) => {
                      setOvertimeHours(sanitizeDecimalInput(e.target.value));
                      clearFieldError("overtimeHours");
                    }}
                    disabled={status !== "present"}
                  />
                </FormField>
                <FormField label={labels.clockIn} error={fieldError("clockIn")} required={status === "present"}>
                  <Input
                    className="mt-1"
                    value={clockIn}
                    onChange={(e) => {
                      setClockIn(e.target.value);
                      clearFieldError("clockIn");
                    }}
                    disabled={status !== "present"}
                    placeholder="08:00"
                  />
                </FormField>
                <FormField label={labels.clockOut} error={fieldError("clockOut")} required={status === "present"}>
                  <Input
                    className="mt-1"
                    value={clockOut}
                    onChange={(e) => {
                      setClockOut(e.target.value);
                      clearFieldError("clockOut");
                    }}
                    disabled={status !== "present"}
                    placeholder="17:00"
                  />
                </FormField>
              </div>
              <Button onClick={handleSave} disabled={loading}>{labels.save}</Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.date}</th>
                  <th className="px-3 py-2">{labels.name}</th>
                  <th className="px-3 py-2">{labels.status}</th>
                  <th className="px-3 py-2">{labels.clockIn}</th>
                  <th className="px-3 py-2">{labels.clockOut}</th>
                  <th className="px-3 py-2">{labels.workedHours}</th>
                  <th className="px-3 py-2">{labels.overtimeHours}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.employeeName}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2">{r.clockIn ?? "—"}</td>
                    <td className="px-3 py-2">{r.clockOut ?? "—"}</td>
                    <td className="px-3 py-2">{r.workedHours}</td>
                    <td className="px-3 py-2">{r.overtimeHours}</td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                      {labels.noAttendance}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {message && <p className="text-sm text-green-600">{message}</p>}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
