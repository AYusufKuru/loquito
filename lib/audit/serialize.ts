import type { Prisma } from "@prisma/client";

import { ACTION_LABELS, ENTITY_TYPE_LABELS, FIELD_LABELS } from "./constants";

type AuditRow = Prisma.AuditLogGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } };
}>;

export interface SerializedAuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  entityType: string;
  entityTypeLabel: string;
  entityId: string;
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  actionLabel: string;
  createdAt: string;
}

function fieldLabel(field: string): string {
  const parts = field.split(".");
  const last = parts[parts.length - 1];
  if (FIELD_LABELS[last]) {
    if (parts.length > 1) {
      const sku = parts.length > 2 ? parts[1] : parts[0];
      return `${sku} · ${FIELD_LABELS[last]}`;
    }
    return FIELD_LABELS[last];
  }
  return field;
}

export function serializeAuditLog(row: AuditRow): SerializedAuditLog {
  const entityType = row.entityType;
  const action = row.action;
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user?.name ?? null,
    userEmail: row.user?.email ?? null,
    entityType,
    entityTypeLabel:
      ENTITY_TYPE_LABELS[entityType as keyof typeof ENTITY_TYPE_LABELS] ?? entityType,
    entityId: row.entityId,
    field: row.field,
    fieldLabel: fieldLabel(row.field),
    oldValue: row.oldValue,
    newValue: row.newValue,
    action,
    actionLabel: ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? action,
    createdAt: row.createdAt.toISOString(),
  };
}
