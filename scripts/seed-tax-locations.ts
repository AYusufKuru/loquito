import { prisma } from "@/lib/prisma";
import { upsertBrazilStateTaxes } from "@/lib/finance/tax-locations";
import { BRAZIL_STATE_TAXES } from "@/lib/finance/brazil-state-taxes";

async function main() {
  const count = await upsertBrazilStateTaxes(prisma);
  const knownCodes = BRAZIL_STATE_TAXES.map((row) => row.code);
  const extras = await prisma.taxLocation.findMany({
    where: { code: { notIn: knownCodes } },
    select: { id: true, code: true, name: true, _count: { select: { orders: true } } },
  });
  for (const row of extras) {
    if (row._count.orders > 0) {
      console.log(`Korundu (siparişte kullanılıyor): ${row.code} ${row.name ?? ""}`);
      continue;
    }
    await prisma.taxLocation.delete({ where: { id: row.id } });
    console.log(`Excel dışı kayıt silindi: ${row.code} ${row.name ?? ""}`);
  }
  const stored = await prisma.taxLocation.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      region: true,
      purchaseTaxPercent: true,
      salesTaxPercent: true,
    },
  });
  console.log(`Upserted ${count} eyalet vergi kaydı (Excel: ${BRAZIL_STATE_TAXES.length}).`);
  for (const row of stored) {
    const buy = row.purchaseTaxPercent == null ? "—" : `${row.purchaseTaxPercent}%`;
    console.log(
      `  ${row.code}  ${row.name}  ${row.region}  alış ${buy}  satış ${row.salesTaxPercent}%`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
