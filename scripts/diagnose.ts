import { prisma } from "@/lib/prisma";
import { analyzeOrderProduction } from "@/lib/orders/production-analysis";

async function main() {
  const orders = await prisma.order.findMany({
    select: { id: true, orderNo: true, status: true, totalCents: true },
  });
  console.log("ORDERS:", orders.length);
  for (const o of orders) {
    console.log(` - ${o.orderNo} [${o.status}] total=${o.totalCents}`);
  }

  for (const o of orders) {
    const a = await analyzeOrderProduction(prisma, o.id);
    if (!a) continue;
    console.log(`\n=== ${a.orderNo} ===`);
    console.log(
      `revenue=${a.totalRevenueCents} material=${a.totalMaterialCostCents} labor=${a.totalLaborCostCents} overhead=${a.totalOverheadCostCents} profit=${a.totalExpectedProfitCents}`,
    );
    console.log(`hasShortage=${a.hasShortage} canStart=${a.canStart}`);
    for (const m of a.materials.filter((x) => x.isShort)) {
      console.log(
        `   SHORT: ${m.materialCode} need=${m.requiredQty} avail=${m.availableQty}`,
      );
    }
    for (const l of a.lines) {
      console.log(
        `   line ${l.productSku}: reqUnits=${l.requiredUnits} stock=${l.stockUnits} fromStock=${l.fromStockUnits} toProduce=${l.toProduceUnits} batches=${l.batchesNeeded} rev=${l.revenueCents}`,
      );
    }
  }

  const water = await prisma.material.findFirst({ where: { code: "SU" } });
  console.log("\nWATER:", water?.currentQty, water?.unitPriceCents, water?.isDailySupply);

  const daily = await prisma.material.findMany({
    where: { isDailySupply: true },
    select: { code: true, currentQty: true },
  });
  console.log("DAILY SUPPLY COUNT:", daily.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
