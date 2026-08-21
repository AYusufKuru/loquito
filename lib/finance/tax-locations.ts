import type { PrismaClient } from "@prisma/client";

import { BRAZIL_STATE_TAXES } from "./brazil-state-taxes";

export interface TaxLocationRow {
  id: string;
  code: string;
  name: string | null;
  region: string | null;
  purchaseTaxPercent: number | null;
  salesTaxPercent: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type Db = PrismaClient;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseTaxPercent(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} geçerli bir sayı olmalıdır.`);
  if (value < 0 || value > 100) throw new Error(`${label} 0 ile 100 arasında olmalıdır.`);
  return Math.round(value * 100) / 100;
}

function parseOptionalTaxPercent(value: number | null | undefined, label: string): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return parseTaxPercent(value, label);
}

export function serializeTaxLocation(row: {
  id: string;
  code: string;
  name: string | null;
  region: string | null;
  purchaseTaxPercent: number | null;
  salesTaxPercent: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TaxLocationRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    region: row.region,
    purchaseTaxPercent: row.purchaseTaxPercent,
    salesTaxPercent: row.salesTaxPercent,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function taxLocationLabel(
  row: Pick<TaxLocationRow, "code" | "name" | "salesTaxPercent">,
): string {
  const title = row.name?.trim() ? `${row.code} — ${row.name}` : row.code;
  return `${title} (satış %${row.salesTaxPercent})`;
}

export async function listTaxLocations(db: Db, activeOnly = false): Promise<TaxLocationRow[]> {
  const rows = await db.taxLocation.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ code: "asc" }],
  });
  return rows.map(serializeTaxLocation);
}

export async function createTaxLocation(
  db: Db,
  data: {
    code: string;
    name?: string | null;
    region?: string | null;
    purchaseTaxPercent?: number | null;
    salesTaxPercent: number;
    notes?: string | null;
    isActive?: boolean;
  },
) {
  const code = normalizeCode(data.code);
  if (!code) throw new Error("Eyalet kodu zorunludur.");
  const salesTaxPercent = parseTaxPercent(data.salesTaxPercent, "Hazır ürün satış vergisi");
  const purchaseTaxPercent = parseOptionalTaxPercent(
    data.purchaseTaxPercent,
    "Hammadde alış vergisi",
  );
  const name = data.name?.trim() || null;
  const region = data.region?.trim() || null;

  const existing = await db.taxLocation.findUnique({ where: { code } });
  if (existing) throw new Error("Bu eyalet kodu zaten kayıtlı.");

  const row = await db.taxLocation.create({
    data: {
      code,
      name,
      region,
      purchaseTaxPercent,
      salesTaxPercent,
      notes: data.notes?.trim() || null,
      isActive: data.isActive ?? true,
    },
  });
  return serializeTaxLocation(row);
}

export async function updateTaxLocation(
  db: Db,
  id: string,
  data: {
    code?: string;
    name?: string | null;
    region?: string | null;
    purchaseTaxPercent?: number | null;
    salesTaxPercent?: number;
    notes?: string | null;
    isActive?: boolean;
  },
) {
  const existing = await db.taxLocation.findUnique({ where: { id } });
  if (!existing) throw new Error("Eyalet bulunamadı.");

  const patch: {
    code?: string;
    name?: string | null;
    region?: string | null;
    purchaseTaxPercent?: number | null;
    salesTaxPercent?: number;
    notes?: string | null;
    isActive?: boolean;
  } = {};

  if (data.code !== undefined) {
    const code = normalizeCode(data.code);
    if (!code) throw new Error("Eyalet kodu zorunludur.");
    if (code !== existing.code) {
      const clash = await db.taxLocation.findUnique({ where: { code } });
      if (clash) throw new Error("Bu eyalet kodu zaten kayıtlı.");
    }
    patch.code = code;
  }
  if (data.name !== undefined) patch.name = data.name?.trim() || null;
  if (data.region !== undefined) patch.region = data.region?.trim() || null;
  if (data.purchaseTaxPercent !== undefined) {
    patch.purchaseTaxPercent = parseOptionalTaxPercent(
      data.purchaseTaxPercent,
      "Hammadde alış vergisi",
    );
  }
  if (data.salesTaxPercent !== undefined) {
    patch.salesTaxPercent = parseTaxPercent(data.salesTaxPercent, "Hazır ürün satış vergisi");
  }
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
  if (data.isActive !== undefined) patch.isActive = data.isActive;

  const row = await db.taxLocation.update({ where: { id }, data: patch });
  return serializeTaxLocation(row);
}

export async function deleteTaxLocation(db: Db, id: string) {
  const existing = await db.taxLocation.findUnique({
    where: { id },
    select: { id: true, _count: { select: { orders: true } } },
  });
  if (!existing) throw new Error("Eyalet bulunamadı.");
  if (existing._count.orders > 0) {
    await db.taxLocation.update({ where: { id }, data: { isActive: false } });
    return { deactivated: true };
  }
  await db.taxLocation.delete({ where: { id } });
  return { deactivated: false };
}

export async function resolveTaxSnapshot(
  db: Db,
  taxLocationId: string | null | undefined,
  options?: { allowInactive?: boolean },
): Promise<{ taxLocationId: string | null; taxPercent: number }> {
  if (!taxLocationId?.trim()) {
    return { taxLocationId: null, taxPercent: 0 };
  }
  const location = await db.taxLocation.findUnique({
    where: { id: taxLocationId },
    select: { id: true, salesTaxPercent: true, isActive: true },
  });
  if (!location) throw new Error("Seçilen eyalet bulunamadı.");
  if (!location.isActive && !options?.allowInactive) {
    throw new Error("Seçilen eyalet pasif.");
  }
  return { taxLocationId: location.id, taxPercent: location.salesTaxPercent };
}

export async function upsertBrazilStateTaxes(db: Db) {
  for (const row of BRAZIL_STATE_TAXES) {
    await db.taxLocation.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        region: row.region,
        purchaseTaxPercent: row.purchaseTaxPercent,
        salesTaxPercent: row.salesTaxPercent,
        notes: row.notes,
        isActive: true,
      },
      update: {
        name: row.name,
        region: row.region,
        purchaseTaxPercent: row.purchaseTaxPercent,
        salesTaxPercent: row.salesTaxPercent,
        notes: row.notes,
        isActive: true,
      },
    });
  }
  return BRAZIL_STATE_TAXES.length;
}
