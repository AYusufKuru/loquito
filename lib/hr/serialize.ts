import type { Employee } from "@prisma/client";

import type { Attendance, WorkAssignment } from "@prisma/client";

import { computeLaborCostCents } from "./labor";
import type { AttendanceRow, EmployeeRow, WorkAssignmentRow } from "./types";

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function serializeEmployee(row: Employee): EmployeeRow {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    department: row.department,
    monthlySalaryCents: row.monthlySalaryCents,
    hourlyRateCents: row.hourlyRateCents,
    overtimeMultiplier: row.overtimeMultiplier,
    shift: row.shift,
    startDate: isoDate(row.startDate),
    phone: row.phone,
    email: row.email,
    isActive: row.isActive,
  };
}

type AttendanceWithEmployee = Attendance & { employee: { name: string } };

export function serializeAttendance(row: AttendanceWithEmployee): AttendanceRow {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    date: isoDate(row.date) ?? "",
    clockIn: row.clockIn,
    clockOut: row.clockOut,
    workedHours: row.workedHours,
    overtimeHours: row.overtimeHours,
    status: row.status,
    notes: row.notes,
  };
}

type AssignmentWithRelations = WorkAssignment & {
  employee: { name: string; hourlyRateCents: number; overtimeMultiplier: number };
  productionOrder: {
    productionNo: string;
    orderId: string | null;
    order: { orderNo: string } | null;
  } | null;
};

export function serializeWorkAssignment(row: AssignmentWithRelations): WorkAssignmentRow {
  const laborCostCents = computeLaborCostCents(
    row.hours,
    row.employee.hourlyRateCents,
    row.employee.overtimeMultiplier,
  );
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    productionOrderId: row.productionOrderId,
    productionNo: row.productionOrder?.productionNo ?? null,
    orderId: row.productionOrder?.orderId ?? null,
    orderNo: row.productionOrder?.order?.orderNo ?? null,
    lineId: row.lineId,
    hours: row.hours,
    date: isoDate(row.date) ?? "",
    notes: row.notes,
    laborCostCents,
  };
}
