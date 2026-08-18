import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import { productionOrderInclude } from "@/lib/production/create-order";
import { prisma } from "@/lib/prisma";

export async function getProductionPageData() {
  return cachedQuery(
    ["production-page-data"],
    async () => {
      const [planOrders, productionOrders, lines] = await Promise.all([
        prisma.order.findMany({
          where: {
            status: {
              in: ["approved", "in_production", "ready_ship", "pending_approval"],
            },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.productionOrder.findMany({
          include: productionOrderInclude,
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        prisma.line.findMany({
          where: { isActive: true },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true, type: true },
        }),
      ]);

      return { planOrders, productionOrders, lines };
    },
    REVALIDATE.production,
    ["production"],
  );
}
