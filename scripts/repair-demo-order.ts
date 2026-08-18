/**
 * Eksik demo siparişini (PED-EXEMPLO-001) oluşturur.
 * Çalıştırma: npx tsx scripts/repair-demo-order.ts
 */
import { PrismaClient } from "@prisma/client";

import { FIXED_EXPENSE_PERIOD_MONTH } from "../prisma/seed-data";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.order.findFirst({
    where: { orderNo: "PED-EXEMPLO-001" },
  });
  if (existing) {
    console.log("Örnek sipariş zaten mevcut:", existing.orderNo);
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { name: { contains: "Pastorinho" } },
  });
  const caf85 = await prisma.product.findFirst({ where: { sku: "BD-85-CAF" } });
  const aca250 = await prisma.product.findFirst({ where: { sku: "BD-250-ACA" } });

  if (!customer || !caf85 || !aca250) {
    console.error("Gerekli veri eksik. npm run db:seed çalıştırın.");
    process.exit(1);
  }

  const box85 = 51450;
  const box250 = 63600;
  const line1Total = 5 * box85;
  const line2Total = 4 * box250;
  const freightCents = 540925 - line1Total - line2Total;

  const order = await prisma.order.create({
    data: {
      orderNo: "PED-EXEMPLO-001",
      customerId: customer.id,
      status: "approved",
      channel: "retail_form",
      orderDate: new Date(`${FIXED_EXPENSE_PERIOD_MONTH}-15T12:00:00`),
      paymentTerms: "30 gün",
      freightType: "Fabrikadan Teslim",
      freightCents,
      totalCents: 540925,
      approvedAt: new Date(),
      items: {
        create: [
          {
            productId: caf85.id,
            quantityBoxes: 5,
            quantityUnits: 250,
            unitPriceCents: 1029,
            boxPriceCents: box85,
            totalCents: line1Total,
          },
          {
            productId: aca250.id,
            quantityBoxes: 4,
            quantityUnits: 160,
            unitPriceCents: 1590,
            boxPriceCents: box250,
            totalCents: line2Total,
          },
        ],
      },
    },
  });

  console.log(`Örnek sipariş oluşturuldu: ${order.orderNo} · R$ ${(order.totalCents / 100).toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
