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
  const [stocks, reserved] = await Promise.all([
    db.finishedGoodsStock.aggregate({
      where: { flavorId, packagingId, status: "available" },
      _sum: { quantity: true },
    }),
    db.finishedGoodsReservation.aggregate({
      where: { flavorId, packagingId, status: "active" },
      _sum: { quantity: true },
    }),
  ]);

  const onHand = stocks._sum.quantity ?? 0;
  const reservedQty = reserved._sum.quantity ?? 0;
  return Math.max(0, onHand - reservedQty);
}
