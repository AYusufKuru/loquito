import type { Prisma, PrismaClient } from "@prisma/client";

import { formatBrlFromCents } from "@/lib/stock/constants";

import type { AuditAction, AuditEntityType } from "./constants";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditChangeInput {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface RecordAuditInput {
  userId?: string | null;
  entityType: AuditEntityType | string;
  entityId: string;
  action?: AuditAction | string;
  changes: AuditChangeInput[];
}

export function formatAuditValue(value: unknown, field?: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (field && (field.endsWith("Cents") || field.includes("PriceCents"))) {
    const num = Number(value);
    if (Number.isFinite(num)) return formatBrlFromCents(num);
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function diffFields(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
  fields: string[],
): AuditChangeInput[] {
  const changes: AuditChangeInput[] = [];
  for (const field of fields) {
    const oldVal = oldRow[field];
    const newVal = newRow[field];
    const oldStr = formatAuditValue(oldVal, field);
    const newStr = formatAuditValue(newVal, field);
    if (oldStr !== newStr) {
      changes.push({ field, oldValue: oldStr, newValue: newStr });
    }
  }
  return changes;
}

export async function recordAudit(db: Db, input: RecordAuditInput): Promise<number> {
  if (input.changes.length === 0) return 0;

  const action = input.action ?? "update";
  await db.auditLog.createMany({
    data: input.changes.map((change) => ({
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      action,
    })),
  });
  return input.changes.length;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  field?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listAuditLogs(db: PrismaClient, filters: AuditLogFilters = {}) {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.field) where.field = { contains: filters.field };
  if (filters.action) where.action = filters.action;

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  return db.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 200,
  });
}

export interface PriceItemRow {
  productId: string;
  sku: string;
  boxPriceCents: number;
  unitPriceCents: number;
}

export function diffPriceItems(
  prefix: string,
  oldItems: PriceItemRow[],
  newItems: PriceItemRow[],
): AuditChangeInput[] {
  const changes: AuditChangeInput[] = [];
  const oldMap = new Map(oldItems.map((i) => [i.productId, i]));
  const newMap = new Map(newItems.map((i) => [i.productId, i]));

  for (const [productId, newItem] of newMap) {
    const oldItem = oldMap.get(productId);
    const sku = newItem.sku || productId;
    if (!oldItem) {
      if (newItem.unitPriceCents > 0) {
        changes.push({
          field: `${prefix}.${sku}.unitPriceCents`,
          oldValue: null,
          newValue: formatBrlFromCents(newItem.unitPriceCents),
        });
      }
      if (newItem.boxPriceCents > 0) {
        changes.push({
          field: `${prefix}.${sku}.boxPriceCents`,
          oldValue: null,
          newValue: formatBrlFromCents(newItem.boxPriceCents),
        });
      }
      continue;
    }
    if (oldItem.unitPriceCents !== newItem.unitPriceCents) {
      changes.push({
        field: `${prefix}.${sku}.unitPriceCents`,
        oldValue: formatBrlFromCents(oldItem.unitPriceCents),
        newValue: formatBrlFromCents(newItem.unitPriceCents),
      });
    }
    if (oldItem.boxPriceCents !== newItem.boxPriceCents) {
      changes.push({
        field: `${prefix}.${sku}.boxPriceCents`,
        oldValue: formatBrlFromCents(oldItem.boxPriceCents),
        newValue: formatBrlFromCents(newItem.boxPriceCents),
      });
    }
  }

  for (const [productId, oldItem] of oldMap) {
    if (!newMap.has(productId)) {
      const sku = oldItem.sku || productId;
      changes.push({
        field: `${prefix}.${sku}`,
        oldValue: `${formatBrlFromCents(oldItem.unitPriceCents)} / ${formatBrlFromCents(oldItem.boxPriceCents)}`,
        newValue: null,
      });
    }
  }

  return changes;
}
