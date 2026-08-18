import type { PrismaClient } from "@prisma/client";

import { DEFAULT_OVERTIME_MULTIPLIER, HOURS_PER_MONTH } from "./constants";
import { serializeEmployee } from "./serialize";
import type { EmployeeInput, EmployeeSummary } from "./types";

type Db = PrismaClient;

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeInput(data: EmployeeInput) {
  const monthlySalaryCents = Math.max(0, Math.round(data.monthlySalaryCents));
  const hourlyRateCents =
    data.hourlyRateCents != null && data.hourlyRateCents > 0
      ? Math.round(data.hourlyRateCents)
      : Math.round(monthlySalaryCents / HOURS_PER_MONTH);

  return {
    name: data.name.trim(),
    role: data.role?.trim() || null,
    department: data.department?.trim() || data.role?.trim() || null,
    monthlySalaryCents,
    hourlyRateCents,
    overtimeMultiplier:
      data.overtimeMultiplier != null && data.overtimeMultiplier > 0
        ? data.overtimeMultiplier
        : DEFAULT_OVERTIME_MULTIPLIER,
    shift: data.shift?.trim() || null,
    startDate: parseDate(data.startDate),
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    isActive: data.isActive ?? true,
  };
}

export async function listEmployees(db: Db, activeOnly = false) {
  return db.employee.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getEmployee(db: Db, id: string) {
  return db.employee.findUnique({ where: { id } });
}

export async function computeEmployeeSummary(db: Db): Promise<EmployeeSummary> {
  const employees = await db.employee.findMany({
    select: { isActive: true, monthlySalaryCents: true },
  });
  const active = employees.filter((e) => e.isActive);
  return {
    totalCount: employees.length,
    activeCount: active.length,
    totalMonthlySalaryCents: active.reduce((s, e) => s + e.monthlySalaryCents, 0),
  };
}

export async function createEmployee(db: Db, data: EmployeeInput) {
  if (!data.name.trim()) throw new Error("Personel adı gerekli.");

  const normalized = normalizeInput(data);
  const employee = await db.employee.create({ data: normalized });
  return serializeEmployee(employee);
}

export async function updateEmployee(db: Db, id: string, data: Partial<EmployeeInput>) {
  const existing = await db.employee.findUnique({ where: { id } });
  if (!existing) throw new Error("Personel bulunamadı.");

  const merged: EmployeeInput = {
    name: data.name ?? existing.name,
    role: data.role !== undefined ? data.role : existing.role,
    department: data.department !== undefined ? data.department : existing.department,
    monthlySalaryCents: data.monthlySalaryCents ?? existing.monthlySalaryCents,
    hourlyRateCents: data.hourlyRateCents ?? existing.hourlyRateCents,
    overtimeMultiplier: data.overtimeMultiplier ?? existing.overtimeMultiplier,
    shift: data.shift !== undefined ? data.shift : existing.shift,
    startDate:
      data.startDate !== undefined
        ? data.startDate
        : existing.startDate
          ? existing.startDate.toISOString().slice(0, 10)
          : null,
    phone: data.phone !== undefined ? data.phone : existing.phone,
    email: data.email !== undefined ? data.email : existing.email,
    isActive: data.isActive ?? existing.isActive,
  };

  const normalized = normalizeInput(merged);
  const employee = await db.employee.update({
    where: { id },
    data: normalized,
  });
  return serializeEmployee(employee);
}
