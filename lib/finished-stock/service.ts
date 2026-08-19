import type { Prisma, PrismaClient } from "@prisma/client";

import { boxesPerBatch, computePackagingCostCents, computeRawCostCents, isPerBatchItem } from "@/lib/recipes/cost";

import type {
  FinishedStockMatrixCell,
  FinishedStockReservationRow,
  FinishedStockRow,
  FinishedStockSummary,
} from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const stockInclude = {
  flavor: { select: { code: true, namePt: true } },
  packaging: { select: { code: true, label: true, netWeightG: true } },
  product: { select: { sku: true, recipeId: true } },
} satisfies Prisma.FinishedGoodsStockInclude;

export async function getReservedQtyForStock(db: Db, stockId: string): Promise<number> {
  const result = await db.finishedGoodsReservation.aggregate({
    where: { stockId, status: "active" },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function getReservedQtyForPair(
  db: Db,
  flavorId: string,
  packagingId: string,
): Promise<number> {
  const result = await db.finishedGoodsReservation.aggregate({
    where: { flavorId, packagingId, status: "active" },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

const costProductInclude = {
  recipe: {
    include: {
      items: {
        include: {
          material: {
            select: {
              id: true,
              code: true,
              name: true,
              unitPriceCents: true,
              subcategory: true,
            },
          },
        },
      },
    },
  },
  packaging: { select: { netWeightG: true } },
} satisfies Prisma.ProductInclude;

type CostProduct = Prisma.ProductGetPayload<{ include: typeof costProductInclude }>;

function unitCostFromProduct(
  product: CostProduct | null,
  packagingId: string,
): number {
  if (!product?.recipe || !product.packaging) return 0;

  const prices = new Map<string, number>();
  for (const item of product.recipe.items) {
    if (item.materialId && item.material) {
      prices.set(item.materialId, item.material.unitPriceCents);
    }
  }

  const bpp = boxesPerBatch(product.recipe.yieldKg, product.packaging.netWeightG);
  const rawItems = product.recipe.items
    .filter((i) => i.itemType === "raw")
    .map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialCode: i.material?.code ?? null,
      materialName: i.material?.name ?? null,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      subcategory: i.material?.subcategory ?? null,
    }));
  const packagingItems = product.recipe.items
    .filter((i) => i.itemType === "packaging" && i.packagingId === packagingId)
    .map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialCode: i.material?.code ?? null,
      materialName: i.material?.name ?? null,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
      packagingId,
      subcategory: i.material?.subcategory ?? null,
      unitPriceCents: i.material?.unitPriceCents ?? 0,
      perBatch: isPerBatchItem(i.material?.subcategory ?? null, i.notes),
    }));

  const batchCost =
    computeRawCostCents(rawItems, prices) +
    computePackagingCostCents(packagingItems, bpp);

  return bpp > 0 ? Math.round(batchCost / bpp) : 0;
}

type StockRow = Prisma.FinishedGoodsStockGetPayload<{ include: typeof stockInclude }>;

/** Stok kaydı başına aktif rezervasyon toplamı, tek sorguda. */
async function loadReservedQtyByStock(
  db: Db,
  stockIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (stockIds.length === 0) return result;

  const grouped = await db.finishedGoodsReservation.groupBy({
    by: ["stockId"],
    where: { stockId: { in: stockIds }, status: "active" },
    _sum: { quantity: true },
  });
  for (const group of grouped) {
    if (group.stockId) result.set(group.stockId, group._sum.quantity ?? 0);
  }
  return result;
}

/**
 * Satırların birim maliyetini iki sorguda hesaplar: ürün kimliğiyle doğrudan
 * eşleşenler ve kimliği olmayan/bulunamayanlar için lezzet × gramaj yedeği.
 * Aynı ürün+gramaj kombinasyonu birden çok lotta tekrar ettiği için sonuç
 * kombinasyon bazında tekilleştirilir.
 */
async function loadUnitCostByRow(
  db: Db,
  rows: StockRow[],
): Promise<Map<string, number>> {
  const costByRow = new Map<string, number>();
  if (rows.length === 0) return costByRow;

  const productIds = [
    ...new Set(rows.map((row) => row.productId).filter((id): id is string => id != null)),
  ];
  const flavorIds = [...new Set(rows.map((row) => row.flavorId))];
  const packagingIds = [...new Set(rows.map((row) => row.packagingId))];

  const [byId, byPairCandidates] = await Promise.all([
    productIds.length > 0
      ? db.product.findMany({
          where: { id: { in: productIds } },
          include: costProductInclude,
        })
      : Promise.resolve([]),
    db.product.findMany({
      where: {
        flavorId: { in: flavorIds },
        packagingId: { in: packagingIds },
        isActive: true,
      },
      include: costProductInclude,
    }),
  ]);

  const productById = new Map(byId.map((product) => [product.id, product]));
  const productByPair = new Map<string, CostProduct>();
  for (const product of byPairCandidates) {
    if (!product.flavorId || !product.packagingId) continue;
    const key = `${product.flavorId}:${product.packagingId}`;
    if (!productByPair.has(key)) productByPair.set(key, product);
  }

  const costByCombination = new Map<string, number>();
  for (const row of rows) {
    const product =
      (row.productId ? productById.get(row.productId) : undefined) ??
      productByPair.get(`${row.flavorId}:${row.packagingId}`) ??
      null;

    const combinationKey = `${product?.id ?? "none"}:${row.packagingId}`;
    let cost = costByCombination.get(combinationKey);
    if (cost === undefined) {
      cost = unitCostFromProduct(product, row.packagingId);
      costByCombination.set(combinationKey, cost);
    }
    costByRow.set(row.id, cost);
  }

  return costByRow;
}

export async function listFinishedStock(db: Db): Promise<FinishedStockRow[]> {
  const rows = await db.finishedGoodsStock.findMany({
    include: stockInclude,
    orderBy: [{ flavor: { sortOrder: "asc" } }, { packaging: { sortOrder: "asc" } }],
  });
  if (rows.length === 0) return [];

  const [reservedByStock, unitCostByRow] = await Promise.all([
    loadReservedQtyByStock(db, rows.map((row) => row.id)),
    loadUnitCostByRow(db, rows),
  ]);

  return rows.map((row) =>
    serializeRow(
      row,
      reservedByStock.get(row.id) ?? 0,
      unitCostByRow.get(row.id) ?? 0,
    ),
  );
}

function serializeRow(
  row: StockRow,
  reservedQty: number,
  unitCostCents: number,
): FinishedStockRow {
  const availableQty = Math.max(0, row.quantity - reservedQty);

  return {
    id: row.id,
    flavorId: row.flavorId,
    flavorCode: row.flavor.code,
    flavorName: row.flavor.namePt,
    packagingId: row.packagingId,
    packagingCode: row.packaging.code,
    packagingLabel: row.packaging.label,
    netWeightG: row.packaging.netWeightG,
    productId: row.productId,
    productSku: row.product?.sku ?? null,
    lotNo: row.lotNo,
    quantity: row.quantity,
    reservedQty,
    availableQty,
    expiryDate: row.expiryDate?.toISOString() ?? null,
    status: row.status,
    unitCostCents,
    valueCents: row.quantity * unitCostCents,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function buildFinishedStockMatrix(db: Db): Promise<FinishedStockMatrixCell[]> {
  const flavors = await db.flavor.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const packagings = await db.packaging.findMany({
    where: { isActive: true, netWeightG: { in: [85, 250] } },
    orderBy: { sortOrder: "asc" },
  });

  const flavorIds = flavors.map((flavor) => flavor.id);
  const packagingIds = packagings.map((packaging) => packaging.id);

  const [stockTotals, reservationTotals] = await Promise.all([
    db.finishedGoodsStock.groupBy({
      by: ["flavorId", "packagingId"],
      where: {
        flavorId: { in: flavorIds },
        packagingId: { in: packagingIds },
        status: "available",
      },
      _sum: { quantity: true },
    }),
    db.finishedGoodsReservation.groupBy({
      by: ["flavorId", "packagingId"],
      where: {
        flavorId: { in: flavorIds },
        packagingId: { in: packagingIds },
        status: "active",
      },
      _sum: { quantity: true },
    }),
  ]);

  const quantityByPair = new Map(
    stockTotals.map((row) => [
      `${row.flavorId}:${row.packagingId}`,
      row._sum.quantity ?? 0,
    ]),
  );
  const reservedByPair = new Map(
    reservationTotals.map((row) => [
      `${row.flavorId}:${row.packagingId}`,
      row._sum.quantity ?? 0,
    ]),
  );

  const cells: FinishedStockMatrixCell[] = [];

  for (const flavor of flavors) {
    for (const packaging of packagings) {
      const pairKey = `${flavor.id}:${packaging.id}`;
      const quantity = quantityByPair.get(pairKey) ?? 0;
      const reservedQty = reservedByPair.get(pairKey) ?? 0;

      cells.push({
        flavorId: flavor.id,
        flavorCode: flavor.code,
        flavorName: flavor.namePt,
        packagingId: packaging.id,
        packagingCode: packaging.code,
        packagingLabel: packaging.label,
        netWeightG: packaging.netWeightG,
        quantity,
        reservedQty,
        availableQty: Math.max(0, quantity - reservedQty),
      });
    }
  }

  return cells;
}

export async function computeFinishedStockSummary(db: Db): Promise<FinishedStockSummary> {
  return summarizeFinishedStock(await listFinishedStock(db));
}

/** Satırlar zaten yüklenmişse stok listesini ikinci kez taramamak için. */
export function summarizeFinishedStock(
  rows: FinishedStockRow[],
): FinishedStockSummary {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  let totalUnits = 0;
  let reservedUnits = 0;
  let totalValueCents = 0;
  let expiringSoonCount = 0;

  for (const row of rows) {
    if (row.status !== "available") continue;
    totalUnits += row.quantity;
    reservedUnits += row.reservedQty;
    totalValueCents += row.valueCents;
    if (row.expiryDate && new Date(row.expiryDate) <= thirtyDays) {
      expiringSoonCount += 1;
    }
  }

  return {
    totalUnits,
    reservedUnits,
    availableUnits: totalUnits - reservedUnits,
    totalValueCents,
    lotCount: rows.filter((r) => r.lotNo).length,
    expiringSoonCount,
  };
}

export async function listReservations(db: Db, orderId?: string): Promise<FinishedStockReservationRow[]> {
  const rows = await db.finishedGoodsReservation.findMany({
    where: orderId ? { orderId } : undefined,
    include: {
      order: { select: { orderNo: true } },
      flavor: { select: { code: true, namePt: true } },
      packaging: { select: { label: true } },
      stock: { select: { lotNo: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNo: r.order.orderNo,
    orderItemId: r.orderItemId,
    stockId: r.stockId,
    flavorCode: r.flavor.code,
    flavorName: r.flavor.namePt,
    packagingLabel: r.packaging.label,
    quantity: r.quantity,
    status: r.status,
    lotNo: r.stock?.lotNo ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function reserveStockForOrder(db: Db, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: { select: { flavorId: true, packagingId: true } } },
      },
    },
  });
  if (!order) throw new Error("Sipariş bulunamadı.");

  const existing = await db.finishedGoodsReservation.count({
    where: { orderId, status: "active" },
  });
  if (existing > 0) throw new Error("Bu sipariş için zaten aktif rezervasyon var.");

  const created: string[] = [];

  for (const item of order.items) {
    const { flavorId, packagingId } = item.product;
    if (!flavorId || !packagingId) continue;

    let remaining = item.quantityUnits;
    const stocks = await db.finishedGoodsStock.findMany({
      where: {
        flavorId,
        packagingId,
        status: "available",
        quantity: { gt: 0 },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });

    for (const stock of stocks) {
      if (remaining <= 0) break;
      const reserved = await getReservedQtyForStock(db, stock.id);
      const available = stock.quantity - reserved;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      const res = await db.finishedGoodsReservation.create({
        data: {
          orderId,
          orderItemId: item.id,
          stockId: stock.id,
          flavorId,
          packagingId,
          quantity: take,
        },
      });
      created.push(res.id);
      remaining -= take;
    }
  }

  if (created.length === 0) {
    throw new Error("Rezerve edilebilir mamul stok bulunamadı.");
  }

  return { reservationIds: created, count: created.length };
}

export async function releaseOrderReservations(db: Db, orderId: string) {
  const updated = await db.finishedGoodsReservation.updateMany({
    where: { orderId, status: "active" },
    data: { status: "released" },
  });
  return updated.count;
}

/** Sevk için mamul stok düşümü — önce rezervasyon, sonra FEFO */
export async function consumeFinishedStockForShipment(
  db: Db,
  _orderId: string,
  orderItemId: string | null,
  quantity: number,
  lotNo?: string | null,
): Promise<string | null> {
  if (quantity <= 0) return null;

  let remaining = quantity;
  let primaryStockId: string | null = null;

  if (orderItemId) {
    const reservations = await db.finishedGoodsReservation.findMany({
      where: { orderItemId, status: "active" },
      orderBy: { createdAt: "asc" },
    });

    for (const res of reservations) {
      if (remaining <= 0) break;
      const take = Math.min(res.quantity, remaining);
      if (!res.stockId) continue;

      await db.finishedGoodsStock.update({
        where: { id: res.stockId },
        data: { quantity: { decrement: take } },
      });

      if (take >= res.quantity) {
        await db.finishedGoodsReservation.update({
          where: { id: res.id },
          data: { status: "fulfilled" },
        });
      } else {
        await db.finishedGoodsReservation.update({
          where: { id: res.id },
          data: { quantity: res.quantity - take },
        });
        await db.finishedGoodsReservation.create({
          data: {
            orderId: res.orderId,
            orderItemId: res.orderItemId,
            stockId: res.stockId,
            flavorId: res.flavorId,
            packagingId: res.packagingId,
            quantity: take,
            status: "fulfilled",
          },
        });
      }

      if (!primaryStockId) primaryStockId = res.stockId;
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const orderItem = orderItemId
      ? await db.orderItem.findUnique({
          where: { id: orderItemId },
          include: { product: { select: { flavorId: true, packagingId: true } } },
        })
      : null;

    if (!orderItem?.product.flavorId || !orderItem.product.packagingId) {
      throw new Error("Rezerve olmayan miktar için stok düşülemedi.");
    }

    const stocks = await db.finishedGoodsStock.findMany({
      where: {
        flavorId: orderItem.product.flavorId,
        packagingId: orderItem.product.packagingId,
        status: "available",
        quantity: { gt: 0 },
        lotNo: lotNo ?? undefined,
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });

    for (const stock of stocks) {
      if (remaining <= 0) break;
      const reserved = await getReservedQtyForStock(db, stock.id);
      const available = stock.quantity - reserved;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      await db.finishedGoodsStock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: take } },
      });
      if (!primaryStockId) primaryStockId = stock.id;
      remaining -= take;
    }
  }

  if (remaining > 0) {
    throw new Error(`Yetersiz mamul stok: ${remaining} adet eksik.`);
  }

  return primaryStockId;
}

export async function updateFinishedStock(
  db: Db,
  id: string,
  data: { quantity?: number; expiryDate?: string | null; status?: string; lotNo?: string | null },
) {
  const patch: Prisma.FinishedGoodsStockUpdateInput = {};
  if (data.quantity != null) patch.quantity = Math.max(0, Math.floor(data.quantity));
  if (data.expiryDate !== undefined) {
    patch.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  }
  if (data.status) patch.status = data.status;
  if (data.lotNo !== undefined) patch.lotNo = data.lotNo;

  return db.finishedGoodsStock.update({
    where: { id },
    data: patch,
    include: stockInclude,
  });
}
