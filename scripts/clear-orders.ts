import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Test için tüm satış siparişlerini ve bağlı üretim/sevkiyat kayıtlarını temizler. */
async function clearOrders() {
  const before = await prisma.order.count();
  console.log(`Mevcut sipariş sayısı: ${before}`);

  const productionOrderIds = (
    await prisma.productionOrder.findMany({ select: { id: true } })
  ).map((p) => p.id);

  if (productionOrderIds.length > 0) {
    await prisma.workAssignment.deleteMany({
      where: { productionOrderId: { in: productionOrderIds } },
    });
    await prisma.scrapRecord.deleteMany({
      where: { productionOrderId: { in: productionOrderIds } },
    });
    await prisma.downtime.deleteMany({
      where: { productionOrderId: { in: productionOrderIds } },
    });
    await prisma.qualityCheck.deleteMany({
      where: { productionOrderId: { in: productionOrderIds } },
    });
    await prisma.productionConsumption.deleteMany({
      where: { productionOrderId: { in: productionOrderIds } },
    });
    await prisma.productionOrder.deleteMany({
      where: { id: { in: productionOrderIds } },
    });
    console.log(`Silinen üretim emri: ${productionOrderIds.length}`);
  }

  const shipmentCount = await prisma.shipment.count();
  if (shipmentCount > 0) {
    await prisma.shipmentItem.deleteMany();
    await prisma.shipment.deleteMany();
    console.log(`Silinen sevkiyat: ${shipmentCount}`);
  }

  await prisma.finishedGoodsReservation.deleteMany();

  const payments = await prisma.payment.findMany({
    where: { orderId: { not: null } },
    select: { id: true },
  });
  if (payments.length > 0) {
    await prisma.receipt.deleteMany({
      where: { paymentId: { in: payments.map((p) => p.id) } },
    });
    await prisma.payment.deleteMany({
      where: { orderId: { not: null } },
    });
    console.log(`Silinen ödeme kaydı: ${payments.length}`);
  }

  await prisma.gmailInboxMessage.updateMany({
    where: { orderId: { not: null } },
    data: { orderId: null },
  });

  await prisma.orderDocument.deleteMany();
  await prisma.orderItem.deleteMany();
  const deleted = await prisma.order.deleteMany();

  console.log(`Silinen sipariş: ${deleted.count}`);
  console.log("Tamamlandı — sipariş listesi boş.");
}

clearOrders()
  .catch((err) => {
    console.error("Hata:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
