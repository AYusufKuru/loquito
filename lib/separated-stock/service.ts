import type { Prisma, PrismaClient } from "@prisma/client";

import { getReservedQtyForStock } from "@/lib/finished-stock/service";

import type { SeparatedLotOption, SeparatedStockRow } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const separatedInclude = {
  flavor: { select: { namePt: true } },
  packaging: { select: { label: true } },
  product: { select: { sku: true } },
} satisfies Prisma.SeparatedStockInclude;

type SeparatedRow = Prisma.SeparatedStockGetPayload<{ include: typeof separatedInclude }>;

function serializeRow(row: SeparatedRow): SeparatedStockRow {
  return {
    id: row.id,
    flavorId: row.flavorId,
    flavorName: row.flavor.namePt,
    packagingId: row.packagingId,
    packagingLabel: row.packaging.label,
    productId: row.productId,
    productSku: row.product?.sku ?? null,
    sourceStockId: row.sourceStockId,
    lotNo: row.lotNo,
    quantity: row.quantity,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSeparatedStock(db: Db): Promise<SeparatedStockRow[]> {
  const rows = await db.separatedStock.findMany({
    where: { quantity: { gt: 0 } },
    include: separatedInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeRow);
}

export async function listSeparatedLotsForPair(
  db: Db,
  flavorId: string,
  packagingId: string,
): Promise<SeparatedLotOption[]> {
  const rows = await db.separatedStock.groupBy({
    by: ["lotNo"],
    where: { flavorId, packagingId, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });
  return rows
    .map((row) => ({
      lotNo: row.lotNo?.trim() || "",
      quantity: row._sum.quantity ?? 0,
    }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
}

export async function getSeparatedQtyForPair(
  db: Db,
  flavorId: string,
  packagingId: string,
): Promise<number> {
  const result = await db.separatedStock.aggregate({
    where: { flavorId, packagingId, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function separateFinishedStock(
  db: PrismaClient,
  input: { stockId: string; quantity: number; notes: string },
) {
  const quantity = Math.floor(input.quantity);
  const notes = input.notes.trim();
  if (quantity <= 0) throw new Error("Ayırılacak adet sıfırdan büyük olmalı.");
  if (!notes) throw new Error("Ayırma notu zorunludur.");

  return db.$transaction(async (tx) => {
    const stock = await tx.finishedGoodsStock.findUnique({
      where: { id: input.stockId },
    });
    if (!stock) throw new Error("Mamul stok kaydı bulunamadı.");
    if (stock.status !== "available") {
      throw new Error("Yalnızca kullanılabilir mamul stok ayrılabilir.");
    }

    const reserved = await getReservedQtyForStock(tx, stock.id);
    const available = Math.max(0, stock.quantity - reserved);
    if (quantity > available) {
      throw new Error(`Kullanılabilir adet yetersiz (${available}).`);
    }

    await tx.finishedGoodsStock.update({
      where: { id: stock.id },
      data: { quantity: { decrement: quantity } },
    });

    const created = await tx.separatedStock.create({
      data: {
        flavorId: stock.flavorId,
        packagingId: stock.packagingId,
        productId: stock.productId,
        sourceStockId: stock.id,
        lotNo: stock.lotNo,
        quantity,
        notes,
      },
      include: separatedInclude,
    });

    return serializeRow(created);
  });
}

export async function consumeSeparatedStock(
  db: Db,
  flavorId: string,
  packagingId: string,
  quantity: number,
  lotNo?: string | null,
): Promise<string | null> {
  if (quantity <= 0) return null;

  let remaining = quantity;
  let primaryId: string | null = null;
  const lotFilter = lotNo?.trim() || undefined;

  const rows = await db.separatedStock.findMany({
    where: {
      flavorId,
      packagingId,
      quantity: { gt: 0 },
      ...(lotFilter ? { lotNo: lotFilter } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantity, remaining);
    await db.separatedStock.update({
      where: { id: row.id },
      data: { quantity: { decrement: take } },
    });
    if (!primaryId) primaryId = row.id;
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`Yetersiz ayrılan stok: ${remaining} adet eksik.`);
  }

  return primaryId;
}

export async function restoreSeparatedStock(
  db: Db,
  item: {
    heldStockId: string | null;
    heldUnitCount: number;
    heldLotNo: string | null;
    flavorId?: string | null;
    packagingId?: string | null;
    productId?: string | null;
  },
) {
  if (item.heldUnitCount <= 0) return;

  if (item.heldStockId) {
    const existing = await db.separatedStock.findUnique({
      where: { id: item.heldStockId },
      select: { id: true },
    });
    if (existing) {
      await db.separatedStock.update({
        where: { id: item.heldStockId },
        data: { quantity: { increment: item.heldUnitCount } },
      });
      return;
    }
  }

  if (!item.flavorId || !item.packagingId) return;

  await db.separatedStock.create({
    data: {
      flavorId: item.flavorId,
      packagingId: item.packagingId,
      productId: item.productId ?? null,
      lotNo: item.heldLotNo,
      quantity: item.heldUnitCount,
      notes: "Sevkiyat iptali ile iade",
    },
  });
}
