import {
  computeOrderTotals,
  marginPercent,
  quantityUnitForChannel,
} from "@/lib/orders/compute";
import { toOrderItemRow, toOrderRow } from "@/lib/orders/serialize";
import { productUnitCostCents } from "@/lib/orders/margin";
import { resolvePrices } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

export async function loadOrderDetail(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      taxLocation: { select: { code: true, name: true } },
      items: {
        include: {
          product: {
            include: {
              packaging: true,
              recipe: {
                include: {
                  items: {
                    include: {
                      material: {
                        select: {
                          unitPriceCents: true,
                          subcategory: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!order) return null;

  const quantityUnit = quantityUnitForChannel(order.channel);
  const useUnits = order.channel === "portal" || order.channel === "proposal";

  const resolvedPrices = await resolvePrices(
    prisma,
    order.customerId,
    order.items.map((item) => ({
      productId: item.productId,
      quantity: useUnits ? item.quantityUnits : item.quantityBoxes,
      quantityUnit,
    })),
    // Geçmiş siparişler kendi dönemindeki liste fiyatıyla karşılaştırılır.
    order.orderDate,
  );

  const items = order.items.map((item, index) => {
    const costUnitCents = productUnitCostCents(item.product);
    const resolved = resolvedPrices[index];
    return toOrderItemRow(item, {
      listUnitPriceCents: resolved?.unitPriceCents,
      listBoxPriceCents: resolved?.boxPriceCents,
      costUnitCents,
      marginPercent: marginPercent(item.unitPriceCents, costUnitCents),
    });
  });

  const { subtotalCents, netCents } = computeOrderTotals(
    items,
    order.discountCents,
    order.freightCents ?? 0,
    order.taxPercent ?? 0,
  );

  return {
    ...toOrderRow(order),
    lineSummaries: items.map((item) => ({
      productSku: item.productSku,
      quantityBoxes: item.quantityBoxes,
      quantityUnits: item.quantityUnits,
    })),
    items,
    subtotalCents,
    netCents,
  };
}
