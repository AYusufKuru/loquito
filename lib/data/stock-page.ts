import {
  buildFinishedStockMatrix,
  computeFinishedStockSummary,
  listFinishedStock,
  listReservations,
} from "@/lib/finished-stock/service";
import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import { prisma } from "@/lib/prisma";
import { computeStockAlerts, computeStockValuation } from "@/lib/stock/inventory";

export async function getStockPageData() {
  return cachedQuery(
    ["stock-page-data"],
    async () => {
      const [
        materials,
        suppliers,
        flavors,
        packagings,
        lots,
        movements,
        valuation,
        alerts,
        quarantineLotCount,
        finishedRows,
        finishedMatrix,
        finishedSummary,
        finishedReservations,
        reserveOrders,
      ] = await Promise.all([
        prisma.material.findMany({
          include: { supplier: { select: { name: true } } },
          orderBy: [{ category: "asc" }, { code: "asc" }],
        }),
        prisma.supplier.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.flavor.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, code: true, namePt: true },
        }),
        prisma.packaging.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, code: true, label: true },
        }),
        prisma.materialLot.findMany({
          where: { quantity: { gt: 0 } },
          include: {
            material: { select: { code: true, name: true, unit: true } },
          },
          orderBy: { receivedAt: "desc" },
          take: 200,
        }),
        prisma.stockMovement.findMany({
          include: {
            material: { select: { code: true, name: true, unit: true } },
            lot: { select: { internalLotNo: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        computeStockValuation(),
        computeStockAlerts(),
        prisma.materialLot.count({
          where: { status: "quarantine", quantity: { gt: 0 } },
        }),
        listFinishedStock(prisma),
        buildFinishedStockMatrix(prisma),
        computeFinishedStockSummary(prisma),
        listReservations(prisma),
        prisma.order.findMany({
          where: {
            status: { in: ["approved", "in_production", "ready_ship"] },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

      return {
        materials,
        suppliers,
        flavors,
        packagings,
        lots,
        movements,
        valuation,
        alerts,
        quarantineLotCount,
        finishedRows,
        finishedMatrix,
        finishedSummary,
        finishedReservations,
        reserveOrders,
      };
    },
    REVALIDATE.stock,
    ["stock"],
  );
}
