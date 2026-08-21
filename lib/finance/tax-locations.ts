import type { PrismaClient } from "@prisma/client";

export interface TaxLocationRow {
  id: string;
  code: string;
  name: string | null;
  taxPercent: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type Db = PrismaClient;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseTaxPercent(value: number): number {
  if (!Number.isFinite(value)) throw new Error("KDV oranı geçerli bir sayı olmalıdır.");
  if (value < 0 || value > 100) throw new Error("KDV oranı 0 ile 100 arasında olmalıdır.");
  return Math.round(value * 100) / 100;
}

export function serializeTaxLocation(row: {
  id: string;
  code: string;
  name: string | null;
  taxPercent: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TaxLocationRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    taxPercent: row.taxPercent,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function taxLocationLabel(row: Pick<TaxLocationRow, "code" | "name" | "taxPercent">): string {
  const title = row.name?.trim() ? `${row.code} — ${row.name}` : row.code;
  return `${title} (${row.taxPercent}%)`;
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
  data: { code: string; name?: string | null; taxPercent: number; notes?: string | null; isActive?: boolean },
) {
  const code = normalizeCode(data.code);
  if (!code) throw new Error("Konum kodu zorunludur.");
  const taxPercent = parseTaxPercent(data.taxPercent);
  const name = data.name?.trim() || null;

  const existing = await db.taxLocation.findUnique({ where: { code } });
  if (existing) throw new Error("Bu konum kodu zaten kayıtlı.");

  const row = await db.taxLocation.create({
    data: {
      code,
      name,
      taxPercent,
      notes: data.notes?.trim() || null,
      isActive: data.isActive ?? true,
    },
  });
  return serializeTaxLocation(row);
}

export async function updateTaxLocation(
  db: Db,
  id: string,
  data: { code?: string; name?: string | null; taxPercent?: number; notes?: string | null; isActive?: boolean },
) {
  const existing = await db.taxLocation.findUnique({ where: { id } });
  if (!existing) throw new Error("Konum bulunamadı.");

  const patch: {
    code?: string;
    name?: string | null;
    taxPercent?: number;
    notes?: string | null;
    isActive?: boolean;
  } = {};

  if (data.code !== undefined) {
    const code = normalizeCode(data.code);
    if (!code) throw new Error("Konum kodu zorunludur.");
    if (code !== existing.code) {
      const clash = await db.taxLocation.findUnique({ where: { code } });
      if (clash) throw new Error("Bu konum kodu zaten kayıtlı.");
    }
    patch.code = code;
  }
  if (data.name !== undefined) patch.name = data.name?.trim() || null;
  if (data.taxPercent !== undefined) patch.taxPercent = parseTaxPercent(data.taxPercent);
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
  if (!existing) throw new Error("Konum bulunamadı.");
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
    select: { id: true, taxPercent: true, isActive: true },
  });
  if (!location) throw new Error("Seçilen KDV konumu bulunamadı.");
  if (!location.isActive && !options?.allowInactive) {
    throw new Error("Seçilen KDV konumu pasif.");
  }
  return { taxLocationId: location.id, taxPercent: location.taxPercent };
}
