import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Bir lezzet × gramaj çifti için başka siparişlere rezerve edilmemiş,
 * gerçekten sevk edilebilir mamul adedi.
 *
 * Üretim analizi ve genel gider dağıtımı bu değeri kullanır; ham
 * `quantity` toplamı rezervasyonları içerdiği için aynı stoğun birden
 * fazla siparişte sayılmasına yol açar.
 */
export async function getAvailableFinishedUnits(
  db: Db,
  flavorId: string,
  packagingId: string,
): Promise<number> {
  const map = await getAvailableFinishedUnitsMap(db, [{ flavorId, packagingId }]);
  return map.get(`${flavorId}:${packagingId}`) ?? 0;
}

function finishedStockKey(flavorId: string, packagingId: string): string {
  return `${flavorId}:${packagingId}`;
}

/** Lezzet × ambalaj çiftleri için kullanılabilir mamul adetlerini toplu döner. */
export async function getAvailableFinishedUnitsMap(
  db: Db,
  pairs: Array<{ flavorId: string; packagingId: string }>,
): Promise<Map<string, number>> {
  const unique = [
    ...new Map(
      pairs.map((pair) => [
        finishedStockKey(pair.flavorId, pair.packagingId),
        pair,
      ]),
    ).values(),
  ];
  const result = new Map<string, number>();
  if (unique.length === 0) return result;

  const flavorIds = [...new Set(unique.map((pair) => pair.flavorId))];
  const packagingIds = [...new Set(unique.map((pair) => pair.packagingId))];

  const [stocks, reservations] = await Promise.all([
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

  const onHand = new Map(
    stocks.map((row) => [
      finishedStockKey(row.flavorId, row.packagingId),
      row._sum.quantity ?? 0,
    ]),
  );
  const reserved = new Map(
    reservations.map((row) => [
      finishedStockKey(row.flavorId, row.packagingId),
      row._sum.quantity ?? 0,
    ]),
  );

  for (const { flavorId, packagingId } of unique) {
    const key = finishedStockKey(flavorId, packagingId);
    const hand = onHand.get(key) ?? 0;
    const res = reserved.get(key) ?? 0;
    result.set(key, Math.max(0, hand - res));
  }

  return result;
}
