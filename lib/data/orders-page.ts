import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import { serializeTaxLocation } from "@/lib/finance/tax-locations";
import { prisma } from "@/lib/prisma";
import { toCatalogProductRow } from "@/lib/products/from-recipe";

export async function getOrdersPageData() {
  return cachedQuery(
    ["orders-page-data"],
    async () => {
      const [
        orders,
        customers,
        salesReps,
        priceLists,
        products,
        orderProducts,
        recipes,
        packagings,
        taxLocations,
      ] = await Promise.all([
          prisma.order.findMany({
            include: {
              customer: { select: { name: true } },
              taxLocation: { select: { code: true, name: true } },
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
            select: {
              id: true,
              sku: true,
              name: true,
              packaging: { select: { unitsPerBox: true } },
            },
          }),
          prisma.product.findMany({
            where: { isActive: true },
            orderBy: { sku: "asc" },
            select: {
              id: true,
              sku: true,
              name: true,
              recipeId: true,
              customerId: true,
              packagingId: true,
              recipe: { select: { code: true, name: true } },
              packaging: {
                select: { label: true, unitsPerBox: true, code: true },
              },
            },
          }),
          prisma.recipe.findMany({
            where: { isActive: true },
            orderBy: { code: "asc" },
            select: { id: true, code: true, name: true },
          }),
          prisma.packaging.findMany({
            where: { isActive: true, unitsPerBox: { gt: 0 } },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              code: true,
              label: true,
              netWeightG: true,
              unitsPerBox: true,
            },
          }),
          prisma.taxLocation.findMany({
            orderBy: { code: "asc" },
          }),
        ]);

      return {
        orders,
        customers,
        salesReps,
        priceLists,
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unitsPerBox: p.packaging?.unitsPerBox ?? 0,
        })),
        orderProducts,
        recipes,
        packagings,
        catalogProducts: orderProducts.map((p) => toCatalogProductRow(p)),
        taxLocations: taxLocations.map(serializeTaxLocation),
      };
    },
    REVALIDATE.orders,
    ["orders"],
  );
}
