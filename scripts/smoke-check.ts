/**
 * Demo verisi ve temel modül erişilebilirliği için duman testi.
 * Çalıştırma: npm run smoke
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Check = {
  name: string;
  actual: number;
  min: number;
};

async function main() {
  const checks: Check[] = [
    { name: "Lezzetler (9)", actual: await prisma.flavor.count(), min: 9 },
    { name: "Ürünler", actual: await prisma.product.count(), min: 1 },
    { name: "Müşteriler", actual: await prisma.customer.count(), min: 1 },
    { name: "Personel", actual: await prisma.employee.count(), min: 1 },
    { name: "Kazan hatları", actual: await prisma.line.count({ where: { type: "cooker" } }), min: 3 },
    { name: "Fabrika ayarları", actual: await prisma.factorySetting.count(), min: 10 },
    { name: "Örnek sipariş", actual: await prisma.order.count(), min: 1 },
    { name: "Kullanıcılar", actual: await prisma.user.count(), min: 2 },
  ];

  let failed = 0;
  console.log("Loquito duman testi\n");

  for (const check of checks) {
    const ok = check.actual >= check.min;
    const icon = ok ? "✓" : "✗";
    console.log(`${icon} ${check.name}: ${check.actual} (min ${check.min})`);
    if (!ok) failed += 1;
  }

  const exampleOrder = await prisma.order.findFirst({
    where: { orderNo: "PED-EXEMPLO-001" },
    select: { totalCents: true, status: true },
  });

  if (exampleOrder) {
    console.log(`\nÖrnek sipariş PED-EXEMPLO-001: R$ ${(exampleOrder.totalCents / 100).toFixed(2)} · ${exampleOrder.status}`);
  } else {
    console.log("\n✗ Örnek sipariş PED-EXEMPLO-001 bulunamadı");
    failed += 1;
  }

  console.log(`\n${failed === 0 ? "Tüm kontroller geçti." : `${failed} kontrol başarısız.`}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
