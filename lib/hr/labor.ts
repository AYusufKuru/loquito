import type { PrismaClient } from "@prisma/client";

import { getAvailableFinishedUnits } from "@/lib/finished-stock/availability";
import { boxesPerBatch } from "@/lib/recipes/cost";

import {
  DEFAULT_CLOCK_IN,
  DEFAULT_CLOCK_OUT,
  STANDARD_WORK_HOURS,
} from "./constants";

type Db = PrismaClient;

export interface WorkScheduleDefaults {
  clockIn: string;
  clockOut: string;
}

export function parseClockToHours(clockIn: string, clockOut: string): number {
  const [inH, inM] = clockIn.split(":").map(Number);
  const [outH, outM] = clockOut.split(":").map(Number);
  if (!Number.isFinite(inH) || !Number.isFinite(outH)) return 0;
  const minutes = outH * 60 + (outM || 0) - (inH * 60 + (inM || 0));
  return Math.max(0, minutes / 60);
}

export function computeWorkedAndOvertime(
  clockIn: string | null,
  clockOut: string | null,
  workedHoursInput?: number,
  overtimeHoursInput?: number,
  schedule?: WorkScheduleDefaults,
): { workedHours: number; overtimeHours: number } {
  if (workedHoursInput != null && workedHoursInput > 0) {
    return {
      workedHours: workedHoursInput,
      overtimeHours: Math.max(0, overtimeHoursInput ?? 0),
    };
  }

  const defaultIn = schedule?.clockIn ?? DEFAULT_CLOCK_IN;
  const defaultOut = schedule?.clockOut ?? DEFAULT_CLOCK_OUT;
  const inTime = clockIn ?? defaultIn;
  const outTime = clockOut ?? defaultOut;
  const total = parseClockToHours(inTime, outTime);
  const workedHours = Math.min(total, STANDARD_WORK_HOURS);
  const overtimeHours = Math.max(0, total - STANDARD_WORK_HOURS);
  return { workedHours, overtimeHours };
}

export async function listAttendance(
  db: Db,
  filters?: { from?: string; to?: string; employeeId?: string },
) {
  const where: {
    employeeId?: string;
    date?: { gte?: Date; lte?: Date };
  } = {};

  if (filters?.employeeId) where.employeeId = filters.employeeId;
  if (filters?.from || filters?.to) {
    where.date = {};
    if (filters.from) where.date.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  return db.attendance.findMany({
    where,
    include: { employee: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { employee: { name: "asc" } }],
    take: 500,
  });
}

export async function upsertAttendance(
  db: Db,
  data: {
    employeeId: string;
    date: string;
    clockIn?: string | null;
    clockOut?: string | null;
    workedHours?: number;
    overtimeHours?: number;
    status?: string;
    notes?: string | null;
  },
) {
  const dateOnly = new Date(data.date);
  if (Number.isNaN(dateOnly.getTime())) throw new Error("Geçersiz tarih.");

  const { loadWorkSchedule } = await import("@/lib/factory/settings-service");
  const schedule = await loadWorkSchedule(db);

  const { workedHours, overtimeHours } = computeWorkedAndOvertime(
    data.clockIn ?? null,
    data.clockOut ?? null,
    data.workedHours,
    data.overtimeHours,
    { clockIn: schedule.workStart, clockOut: schedule.workEnd },
  );

  const existing = await db.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: dateOnly,
      },
    },
  });

  const payload = {
    clockIn: data.clockIn ?? schedule.workStart,
    clockOut: data.clockOut ?? schedule.workEnd,
    workedHours,
    overtimeHours,
    status: data.status ?? "present",
    notes: data.notes ?? null,
  };

  if (existing) {
    return db.attendance.update({
      where: { id: existing.id },
      data: payload,
      include: { employee: { select: { name: true } } },
    });
  }

  return db.attendance.create({
    data: {
      employeeId: data.employeeId,
      date: dateOnly,
      ...payload,
    },
    include: { employee: { select: { name: true } } },
  });
}

export async function getFactoryLaborHoursPerBatch(db: Db): Promise<number> {
  const setting = await db.factorySetting.findUnique({
    where: { key: "batch_cook_hours" },
  });
  const hours = Number(setting?.value);
  return Number.isFinite(hours) && hours > 0 ? hours : 3.5;
}

/** Bir partiyi pişiren ekipteki kişi sayısı (varsayılan: 1 usta + 1 yardımcı). */
export async function getFactoryCookTeamSize(db: Db): Promise<number> {
  const setting = await db.factorySetting.findUnique({
    where: { key: "cook_team_size" },
  });
  const size = Number(setting?.value);
  return Number.isFinite(size) && size > 0 ? size : 2;
}

export async function getAvgProductionHourlyRateCents(db: Db): Promise<number> {
  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { contains: "Pişirme" } },
        { role: { contains: "Kesim" } },
        { role: { contains: "Dizim" } },
        { role: { contains: "Paketleme" } },
        { role: { contains: "İmalat" } },
        { role: { contains: "Genel" } },
      ],
    },
    select: { hourlyRateCents: true },
  });
  if (employees.length === 0) {
    const all = await db.employee.findMany({
      where: { isActive: true },
      select: { hourlyRateCents: true },
    });
    if (all.length === 0) return 0;
    return Math.round(
      all.reduce((s, e) => s + e.hourlyRateCents, 0) / all.length,
    );
  }
  return Math.round(
    employees.reduce((s, e) => s + e.hourlyRateCents, 0) / employees.length,
  );
}

export function computeLaborCostCents(
  hours: number,
  hourlyRateCents: number,
  overtimeMultiplier = 1.5,
  overtimeHours = 0,
): number {
  const regularHours = Math.max(0, hours - overtimeHours);
  const regular = regularHours * hourlyRateCents;
  const overtime = overtimeHours * hourlyRateCents * overtimeMultiplier;
  return Math.round(regular + overtime);
}

export async function listWorkAssignments(
  db: Db,
  filters?: { orderId?: string; from?: string; to?: string },
) {
  const where: {
    productionOrder?: { orderId?: string };
    date?: { gte?: Date; lte?: Date };
  } = {};

  if (filters?.orderId) {
    where.productionOrder = { orderId: filters.orderId };
  }
  if (filters?.from || filters?.to) {
    where.date = {};
    if (filters.from) where.date.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  return db.workAssignment.findMany({
    where,
    include: {
      employee: {
        select: {
          name: true,
          hourlyRateCents: true,
          overtimeMultiplier: true,
        },
      },
      productionOrder: {
        select: {
          productionNo: true,
          orderId: true,
          order: { select: { orderNo: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }],
    take: 300,
  });
}

export async function createWorkAssignment(
  db: Db,
  data: {
    employeeId: string;
    productionOrderId?: string | null;
    lineId?: string | null;
    hours: number;
    date: string;
    notes?: string | null;
  },
) {
  if (data.hours <= 0) throw new Error("Çalışma saati sıfırdan büyük olmalı.");

  const employee = await db.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new Error("Personel bulunamadı.");

  const dateOnly = new Date(data.date);
  if (Number.isNaN(dateOnly.getTime())) throw new Error("Geçersiz tarih.");

  if (data.productionOrderId) {
    const po = await db.productionOrder.findUnique({
      where: { id: data.productionOrderId },
    });
    if (!po) throw new Error("Üretim emri bulunamadı.");
  }

  return db.workAssignment.create({
    data: {
      employeeId: data.employeeId,
      productionOrderId: data.productionOrderId ?? null,
      lineId: data.lineId ?? null,
      hours: data.hours,
      date: dateOnly,
      notes: data.notes ?? null,
    },
    include: {
      employee: {
        select: { name: true, hourlyRateCents: true, overtimeMultiplier: true },
      },
      productionOrder: {
        select: {
          productionNo: true,
          orderId: true,
          order: { select: { orderNo: true } },
        },
      },
    },
  });
}

export async function computeOrderLaborCost(db: Db, orderId: string) {
  const assignments = await listWorkAssignments(db, { orderId });
  let totalLaborCostCents = 0;
  let recordedHours = 0;

  for (const row of assignments) {
    recordedHours += row.hours;
    totalLaborCostCents += computeLaborCostCents(
      row.hours,
      row.employee.hourlyRateCents,
      row.employee.overtimeMultiplier,
    );
  }

  let estimatedHours = 0;
  let isEstimated = false;

  if (assignments.length === 0) {
    const productionOrders = await db.productionOrder.findMany({
      where: { orderId },
      select: { id: true },
    });
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                packaging: true,
                recipe: { select: { yieldKg: true } },
              },
            },
          },
        },
      },
    });

    if (order) {
      const hoursPerBatch = await getFactoryLaborHoursPerBatch(db);
      const avgHourly = await getAvgProductionHourlyRateCents(db);
      const teamSize = await getFactoryCookTeamSize(db);

      let totalBatches = 0;
      for (const item of order.items) {
        const packaging = item.product.packaging;
        const recipe = item.product.recipe;
        if (!packaging || !recipe) continue;
        const unitsPerBox = packaging.unitsPerBox ?? 1;

        // Mamul stoktan karşılanan adet için işçilik harcanmaz.
        const stockUnits =
          item.product.flavorId && item.product.packagingId
            ? await getAvailableFinishedUnits(
                db,
                item.product.flavorId,
                item.product.packagingId,
              )
            : 0;
        const toProduceUnits = Math.max(
          0,
          item.quantityUnits - Math.min(item.quantityUnits, stockUnits),
        );

        const toProduceBoxes = Math.ceil(toProduceUnits / unitsPerBox);
        const bpp = boxesPerBatch(recipe.yieldKg, packaging.netWeightG);
        if (bpp > 0 && toProduceBoxes > 0) {
          totalBatches += Math.ceil(toProduceBoxes / bpp);
        }
      }

      estimatedHours = totalBatches * hoursPerBatch * teamSize;
      totalLaborCostCents = Math.round(estimatedHours * avgHourly);
      isEstimated = totalBatches > 0;
    }

    if (productionOrders.length > 0 && !isEstimated) {
      isEstimated = false;
    }
  }

  return {
    orderId,
    totalLaborCostCents,
    recordedHours,
    estimatedHours,
    isEstimated,
    assignmentCount: assignments.length,
  };
}

export async function computePayrollSummary(db: Db, month: string): Promise<{
  month: string;
  employeeCount: number;
  totalWorkedHours: number;
  totalOvertimeHours: number;
  totalRegularPayCents: number;
  totalOvertimePayCents: number;
  totalPayCents: number;
  rows: Array<{
    employeeId: string;
    employeeName: string;
    role: string | null;
    workedHours: number;
    overtimeHours: number;
    regularPayCents: number;
    overtimePayCents: number;
    totalPayCents: number;
    absentDays: number;
    leaveDays: number;
  }>;
}> {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) throw new Error("Geçersiz ay formatı (YYYY-MM).");

  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 0, 23, 59, 59, 999);

  const employees = await db.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const attendance = await db.attendance.findMany({
    where: { date: { gte: from, lte: to } },
  });

  const attByEmployee = new Map<string, typeof attendance>();
  for (const a of attendance) {
    const list = attByEmployee.get(a.employeeId) ?? [];
    list.push(a);
    attByEmployee.set(a.employeeId, list);
  }

  const rows = employees.map((emp) => {
    const records = attByEmployee.get(emp.id) ?? [];
    let workedHours = 0;
    let overtimeHours = 0;
    let absentDays = 0;
    let leaveDays = 0;

    for (const r of records) {
      if (r.status === "absent") absentDays += 1;
      if (r.status === "leave" || r.status === "sick") leaveDays += 1;
      if (r.status === "present") {
        workedHours += r.workedHours;
        overtimeHours += r.overtimeHours;
      }
    }

    const regularPayCents = Math.round(workedHours * emp.hourlyRateCents);
    const overtimePayCents = Math.round(
      overtimeHours * emp.hourlyRateCents * emp.overtimeMultiplier,
    );

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      workedHours: round1(workedHours),
      overtimeHours: round1(overtimeHours),
      regularPayCents,
      overtimePayCents,
      totalPayCents: regularPayCents + overtimePayCents,
      absentDays,
      leaveDays,
    };
  });

  return {
    month,
    employeeCount: employees.length,
    totalWorkedHours: round1(rows.reduce((s, r) => s + r.workedHours, 0)),
    totalOvertimeHours: round1(rows.reduce((s, r) => s + r.overtimeHours, 0)),
    totalRegularPayCents: rows.reduce((s, r) => s + r.regularPayCents, 0),
    totalOvertimePayCents: rows.reduce((s, r) => s + r.overtimePayCents, 0),
    totalPayCents: rows.reduce((s, r) => s + r.totalPayCents, 0),
    rows,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
