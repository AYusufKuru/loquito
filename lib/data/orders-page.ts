import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import { prisma } from "@/lib/prisma";

export async function getOrdersPageData() {
  return cachedQuery(
    ["orders-page-data"],
    async () => {
      const [orders, customers, salesReps, priceLists, products, orderProducts] =
        await Promise.all([
          prisma.order.findMany({
            include: {
              customer: { select: { name: true } },
              items: {
                select: {
                  quantityBoxes: true,
                  quantityUnits: true,
                  product: { select: { sku: true } },
                },
                orderBy: { id: "asc" },
              },
            },
            orderBy: { orderDate: "desc" },
          }),
          prisma.customer.findMany({
            include: {
              salesRep: { select: { name: true } },
              priceList: { select: { name: true } },
              customerPrices: { select: { id: true } },
              priceTiers: { select: { id: true } },
              channelCodes: { select: { id: true } },
            },
            orderBy: { name: "asc" },
          }),
          prisma.salesRep.findMany({
            include: { customers: { select: { id: true } } },
            orderBy: { name: "asc" },
          }),
          prisma.priceList.findMany({
            include: {
              items: { select: { id: true } },
              customers: { select: { id: true } },
            },
            orderBy: { code: "asc" },
          }),
          prisma.product.findMany({
            where: { isActive: true, customerId: null },
            orderBy: { sku: "asc" },
            select: { id: true, sku: true, name: true },
          }),
          prisma.product.findMany({
            where: { isActive: true },
            orderBy: { sku: "asc" },
            select: {
              id: true,
              sku: true,
              name: true,
              customerId: true,
              packaging: { select: { unitsPerBox: true, code: true } },
            },
          }),
        ]);

      return { orders, customers, salesReps, priceLists, products, orderProducts };
    },
    REVALIDATE.orders,
    ["orders"],
  );
}
