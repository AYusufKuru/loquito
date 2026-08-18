import type { PrismaClient } from "@prisma/client";

import { recordAudit } from "@/lib/audit/service";

import { parsePeriodMonth } from "./constants";
import type { FixedExpenseRow, PeriodExpenseSummary } from "./types";

type Db = PrismaClient;

export function serializeFixedExpense(row: {
  id: string;
  periodMonth: string;
  name: string;
  amountCents: number;
  category: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FixedExpenseRow {
  return {
    id: row.id,
    periodMonth: row.periodMonth,
    name: row.name,
    amountCents: row.amountCents,
    category: row.category,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFixedExpenses(db: Db, periodMonth: string) {
  return db.fixedExpense.findMany({
    where: { periodMonth },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function listPeriodSummaries(
  db: Db,
  months: string[],
): Promise<PeriodExpenseSummary[]> {
  const summaries: PeriodExpenseSummary[] = [];

  for (const periodMonth of months) {
    const rows = await db.fixedExpense.findMany({ where: { periodMonth } });
    summaries.push({
      periodMonth,
      totalCents: rows.filter((r) => r.isActive).reduce((s, r) => s + r.amountCents, 0),
      itemCount: rows.length,
      activeCount: rows.filter((r) => r.isActive).length,
    });
  }

  return summaries;
}

export async function createFixedExpense(
  db: Db,
  data: {
    periodMonth: string;
    name: string;
    amountCents: number;
    category?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
  actorId?: string,
) {
  if (!parsePeriodMonth(data.periodMonth)) {
    throw new Error("Geçersiz dönem (YYYY-MM).");
  }
  const name = data.name.trim();
  if (!name) throw new Error("Gider adı gerekli.");
  if (data.amountCents < 0) throw new Error("Tutar negatif olamaz.");

  const existing = await db.fixedExpense.findUnique({
    where: {
      periodMonth_name: { periodMonth: data.periodMonth, name },
    },
  });
  if (existing) throw new Error("Bu dönemde aynı adlı gider zaten var.");

  const expense = await db.fixedExpense.create({
    data: {
      periodMonth: data.periodMonth,
      name,
      amountCents: data.amountCents,
      category: data.category ?? null,
      notes: data.notes ?? null,
      isActive: data.isActive ?? true,
    },
  });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "fixed_expense",
      entityId: expense.id,
      action: "create",
      changes: [
        {
          field: "amountCents",
          oldValue: null,
          newValue: String(data.amountCents),
        },
      ],
    });
  }

  return expense;
}

export async function updateFixedExpense(
  db: Db,
  id: string,
  data: {
    name?: string;
    amountCents?: number;
    category?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
  actorId?: string,
) {
  const existing = await db.fixedExpense.findUnique({ where: { id } });
  if (!existing) throw new Error("Gider bulunamadı.");

  const updates: {
    name?: string;
    amountCents?: number;
    category?: string | null;
    notes?: string | null;
    isActive?: boolean;
  } = {};

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Gider adı gerekli.");
    if (name !== existing.name) {
      const dup = await db.fixedExpense.findUnique({
        where: {
          periodMonth_name: { periodMonth: existing.periodMonth, name },
        },
      });
      if (dup) throw new Error("Bu dönemde aynı adlı gider zaten var.");
      updates.name = name;
    }
  }

  if (data.amountCents !== undefined) {
    if (data.amountCents < 0) throw new Error("Tutar negatif olamaz.");
    updates.amountCents = data.amountCents;
  }
  if (data.category !== undefined) updates.category = data.category;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const expense = await db.fixedExpense.update({
    where: { id },
    data: updates,
  });

  if (actorId) {
    const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
    for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
      const oldVal = existing[key as keyof typeof existing];
      const newVal = updates[key];
      if (newVal !== oldVal) {
        changes.push({
          field: key,
          oldValue: oldVal == null ? null : String(oldVal),
          newValue: newVal == null ? null : String(newVal),
        });
      }
    }
    if (changes.length > 0) {
      await recordAudit(db, {
        userId: actorId,
        entityType: "fixed_expense",
        entityId: id,
        action: "update",
        changes,
      });
    }
  }

  return expense;
}

export async function deleteFixedExpense(db: Db, id: string, actorId?: string) {
  const existing = await db.fixedExpense.findUnique({ where: { id } });
  if (!existing) throw new Error("Gider bulunamadı.");

  await db.fixedExpense.delete({ where: { id } });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "fixed_expense",
      entityId: id,
      action: "delete",
      changes: [],
    });
  }
}

export async function copyExpensesToMonth(
  db: Db,
  fromMonth: string,
  toMonth: string,
  actorId?: string,
) {
  if (!parsePeriodMonth(fromMonth) || !parsePeriodMonth(toMonth)) {
    throw new Error("Geçersiz dönem (YYYY-MM).");
  }

  const source = await listFixedExpenses(db, fromMonth);
  if (source.length === 0) throw new Error("Kaynak dönemde gider yok.");

  const created: FixedExpenseRow[] = [];
  for (const row of source) {
    const dup = await db.fixedExpense.findUnique({
      where: {
        periodMonth_name: { periodMonth: toMonth, name: row.name },
      },
    });
    if (dup) continue;

    const expense = await createFixedExpense(
      db,
      {
        periodMonth: toMonth,
        name: row.name,
        amountCents: row.amountCents,
        category: row.category,
        notes: row.notes,
        isActive: row.isActive,
      },
      actorId,
    );
    created.push(serializeFixedExpense(expense));
  }

  return created;
}
