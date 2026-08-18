import type { PrismaClient } from "@prisma/client";

import { recordAudit } from "@/lib/audit/service";

import {
  PURCHASE_STATUSES,
  STATUS_TRANSITIONS,
  type PurchaseStatus,
} from "./constants";
import type { AssetRow, PurchaseRequestRow, PurchaseSummary } from "./types";

type Db = PrismaClient;

export function serializeAsset(row: {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  valueCents: number;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AssetRow {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    valueCents: row.valueCents,
    location: row.location,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializePurchaseRequest(row: {
  id: string;
  requestType: string;
  itemName: string;
  description: string | null;
  usageArea: string | null;
  quantity: number;
  unit: string | null;
  priority: string | null;
  supplierId: string | null;
  unitPriceCents: number;
  totalCents: number;
  deliveryDays: number | null;
  warranty: string | null;
  status: string;
  approvedBy: string | null;
  orderNo: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier?: { name: string } | null;
}): PurchaseRequestRow {
  return {
    id: row.id,
    requestType: row.requestType,
    itemName: row.itemName,
    description: row.description,
    usageArea: row.usageArea,
    quantity: row.quantity,
    unit: row.unit,
    priority: row.priority,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    unitPriceCents: row.unitPriceCents,
    totalCents: row.totalCents,
    deliveryDays: row.deliveryDays,
    warranty: row.warranty,
    status: row.status,
    approvedBy: row.approvedBy,
    orderNo: row.orderNo,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssets(db: Db) {
  return db.asset.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function createAsset(
  db: Db,
  data: {
    name: string;
    category?: string | null;
    quantity?: number;
    valueCents?: number;
    location?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
  actorId?: string,
) {
  const name = data.name.trim();
  if (!name) throw new Error("Demirbaş adı gerekli.");
  const quantity = data.quantity ?? 1;
  if (quantity < 0) throw new Error("Miktar negatif olamaz.");
  const valueCents = data.valueCents ?? 0;
  if (valueCents < 0) throw new Error("Değer negatif olamaz.");

  const asset = await db.asset.create({
    data: {
      name,
      category: data.category ?? null,
      quantity,
      valueCents,
      location: data.location ?? null,
      notes: data.notes ?? null,
      isActive: data.isActive ?? true,
    },
  });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "asset",
      entityId: asset.id,
      action: "create",
      changes: [{ field: "name", oldValue: null, newValue: name }],
    });
  }

  return asset;
}

export async function updateAsset(
  db: Db,
  id: string,
  data: {
    name?: string;
    category?: string | null;
    quantity?: number;
    valueCents?: number;
    location?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
  actorId?: string,
) {
  const existing = await db.asset.findUnique({ where: { id } });
  if (!existing) throw new Error("Demirbaş bulunamadı.");

  const updates: Parameters<typeof db.asset.update>[0]["data"] = {};
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Demirbaş adı gerekli.");
    updates.name = name;
    if (name !== existing.name) {
      changes.push({ field: "name", oldValue: existing.name, newValue: name });
    }
  }
  if (data.category !== undefined) {
    updates.category = data.category;
    if (data.category !== existing.category) {
      changes.push({
        field: "category",
        oldValue: existing.category,
        newValue: data.category,
      });
    }
  }
  if (data.quantity !== undefined) {
    if (data.quantity < 0) throw new Error("Miktar negatif olamaz.");
    updates.quantity = data.quantity;
    if (data.quantity !== existing.quantity) {
      changes.push({
        field: "quantity",
        oldValue: String(existing.quantity),
        newValue: String(data.quantity),
      });
    }
  }
  if (data.valueCents !== undefined) {
    if (data.valueCents < 0) throw new Error("Değer negatif olamaz.");
    updates.valueCents = data.valueCents;
    if (data.valueCents !== existing.valueCents) {
      changes.push({
        field: "valueCents",
        oldValue: String(existing.valueCents),
        newValue: String(data.valueCents),
      });
    }
  }
  if (data.location !== undefined) updates.location = data.location;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) {
    updates.isActive = data.isActive;
    if (data.isActive !== existing.isActive) {
      changes.push({
        field: "isActive",
        oldValue: String(existing.isActive),
        newValue: String(data.isActive),
      });
    }
  }

  const asset = await db.asset.update({ where: { id }, data: updates });

  if (actorId && changes.length > 0) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "asset",
      entityId: id,
      action: "update",
      changes,
    });
  }

  return asset;
}

export async function deleteAsset(db: Db, id: string, actorId?: string) {
  const existing = await db.asset.findUnique({ where: { id } });
  if (!existing) throw new Error("Demirbaş bulunamadı.");

  await db.asset.delete({ where: { id } });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "asset",
      entityId: id,
      action: "delete",
      changes: [{ field: "name", oldValue: existing.name, newValue: null }],
    });
  }
}

export async function listPurchaseRequests(
  db: Db,
  filters?: { status?: string },
) {
  return db.purchaseRequest.findMany({
    where: filters?.status ? { status: filters.status } : undefined,
    include: { supplier: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPurchaseSummary(db: Db): Promise<PurchaseSummary> {
  const rows = await db.purchaseRequest.findMany({
    select: { status: true, totalCents: true },
  });

  let pendingApprovalCount = 0;
  let pendingApprovalTotalCents = 0;
  let approvedTotalCents = 0;
  let orderedTotalCents = 0;

  for (const row of rows) {
    if (row.status === "pending_approval") {
      pendingApprovalCount += 1;
      pendingApprovalTotalCents += row.totalCents;
    } else if (row.status === "approved") {
      approvedTotalCents += row.totalCents;
    } else if (row.status === "ordered") {
      orderedTotalCents += row.totalCents;
    }
  }

  return {
    pendingApprovalCount,
    pendingApprovalTotalCents,
    approvedTotalCents,
    orderedTotalCents,
  };
}

function computeTotalCents(quantity: number, unitPriceCents: number, totalCents?: number) {
  if (totalCents != null && totalCents > 0) return totalCents;
  return Math.round(quantity * unitPriceCents);
}

export async function createPurchaseRequest(
  db: Db,
  data: {
    requestType: string;
    itemName: string;
    description?: string | null;
    usageArea?: string | null;
    quantity?: number;
    unit?: string | null;
    priority?: string | null;
    supplierId?: string | null;
    unitPriceCents?: number;
    totalCents?: number;
    deliveryDays?: number | null;
    warranty?: string | null;
    notes?: string | null;
  },
  actorId?: string,
) {
  const itemName = data.itemName.trim();
  if (!itemName) throw new Error("Kalem adı gerekli.");
  const requestType = data.requestType.trim();
  if (!requestType) throw new Error("Talep türü gerekli.");

  const quantity = data.quantity ?? 1;
  if (quantity <= 0) throw new Error("Miktar sıfırdan büyük olmalı.");

  const unitPriceCents = data.unitPriceCents ?? 0;
  const totalCents = computeTotalCents(quantity, unitPriceCents, data.totalCents);

  const request = await db.purchaseRequest.create({
    data: {
      requestType,
      itemName,
      description: data.description ?? null,
      usageArea: data.usageArea ?? null,
      quantity,
      unit: data.unit ?? null,
      priority: data.priority ?? null,
      supplierId: data.supplierId ?? null,
      unitPriceCents,
      totalCents,
      deliveryDays: data.deliveryDays ?? null,
      warranty: data.warranty ?? null,
      status: "pending_approval",
      notes: data.notes ?? null,
    },
    include: { supplier: { select: { name: true } } },
  });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "purchase_request",
      entityId: request.id,
      action: "create",
      changes: [
        { field: "itemName", oldValue: null, newValue: itemName },
        { field: "totalCents", oldValue: null, newValue: String(totalCents) },
      ],
    });
  }

  return request;
}

export async function updatePurchaseRequest(
  db: Db,
  id: string,
  data: {
    requestType?: string;
    itemName?: string;
    description?: string | null;
    usageArea?: string | null;
    quantity?: number;
    unit?: string | null;
    priority?: string | null;
    supplierId?: string | null;
    unitPriceCents?: number;
    totalCents?: number;
    deliveryDays?: number | null;
    warranty?: string | null;
    notes?: string | null;
    orderNo?: string | null;
  },
  actorId?: string,
) {
  const existing = await db.purchaseRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Talep bulunamadı.");
  if (existing.status !== "pending_approval") {
    throw new Error("Yalnızca onay bekleyen talepler düzenlenebilir.");
  }

  const updates: Parameters<typeof db.purchaseRequest.update>[0]["data"] = {};
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  if (data.requestType !== undefined) updates.requestType = data.requestType.trim();
  if (data.itemName !== undefined) {
    const itemName = data.itemName.trim();
    if (!itemName) throw new Error("Kalem adı gerekli.");
    updates.itemName = itemName;
  }
  if (data.description !== undefined) updates.description = data.description;
  if (data.usageArea !== undefined) updates.usageArea = data.usageArea;
  if (data.quantity !== undefined) {
    if (data.quantity <= 0) throw new Error("Miktar sıfırdan büyük olmalı.");
    updates.quantity = data.quantity;
  }
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.supplierId !== undefined) updates.supplierId = data.supplierId;
  if (data.unitPriceCents !== undefined) updates.unitPriceCents = data.unitPriceCents;
  if (data.deliveryDays !== undefined) updates.deliveryDays = data.deliveryDays;
  if (data.warranty !== undefined) updates.warranty = data.warranty;
  if (data.notes !== undefined) updates.notes = data.notes;

  const quantity = Number(updates.quantity ?? existing.quantity);
  const unitPriceCents = Number(updates.unitPriceCents ?? existing.unitPriceCents);
  if (data.totalCents !== undefined) {
    updates.totalCents = data.totalCents;
  } else if (data.quantity !== undefined || data.unitPriceCents !== undefined) {
    updates.totalCents = Math.round(quantity * unitPriceCents);
  }

  if (updates.totalCents !== undefined && updates.totalCents !== existing.totalCents) {
    changes.push({
      field: "totalCents",
      oldValue: String(existing.totalCents),
      newValue: String(updates.totalCents),
    });
  }

  const request = await db.purchaseRequest.update({
    where: { id },
    data: updates,
    include: { supplier: { select: { name: true } } },
  });

  if (actorId && changes.length > 0) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "purchase_request",
      entityId: id,
      action: "update",
      changes,
    });
  }

  return request;
}

export async function advancePurchaseStatus(
  db: Db,
  id: string,
  actorId?: string,
  options?: { orderNo?: string; approvedBy?: string },
) {
  const existing = await db.purchaseRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Talep bulunamadı.");

  const current = existing.status as PurchaseStatus;
  if (!PURCHASE_STATUSES.includes(current)) {
    throw new Error("Geçersiz talep durumu.");
  }

  const next = STATUS_TRANSITIONS[current];
  if (!next) throw new Error("Bu talep için ileri durum geçişi yok.");

  if (next === "ordered" && !options?.orderNo?.trim()) {
    throw new Error("Sipariş numarası gerekli.");
  }

  const updates: Parameters<typeof db.purchaseRequest.update>[0]["data"] = {
    status: next,
  };

  if (next === "approved" && options?.approvedBy) {
    updates.approvedBy = options.approvedBy;
  } else if (next === "approved" && actorId) {
    updates.approvedBy = actorId;
  }

  if (next === "ordered") {
    updates.orderNo = options?.orderNo?.trim() ?? null;
  }

  const request = await db.purchaseRequest.update({
    where: { id },
    data: updates,
    include: { supplier: { select: { name: true } } },
  });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "purchase_request",
      entityId: id,
      action: "status_change",
      changes: [
        { field: "status", oldValue: current, newValue: next },
      ],
    });
  }

  return request;
}
