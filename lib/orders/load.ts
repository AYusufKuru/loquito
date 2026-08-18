import {
  computeOrderTotals,
  marginPercent,
  quantityUnitForChannel,
} from "@/lib/orders/compute";
import { toOrderItemRow, toOrderRow } from "@/lib/orders/serialize";
import { getProductUnitCostCents } from "@/lib/orders/margin";
import { resolvePrice } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

export async function loadOrderDetail(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: {
            include: { packaging: true },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!order) return null;

  const items = await Promise.all(
    order.items.map(async (item) => {
      const costUnitCents = await getProductUnitCostCents(prisma, item.productId);
      const resolved = await resolvePrice(
        prisma,
        order.customerId,
        item.productId,
        order.channel === "portal" || order.channel === "proposal"
          ? item.quantityUnits
          : item.quantityBoxes,
        quantityUnitForChannel(order.channel),
        // Geçmiş siparişler kendi dönemindeki liste fiyatıyla karşılaştırılır.
        order.orderDate,
      );
      return toOrderItemRow(item, {
        listUnitPriceCents: resolved.unitPriceCents,
        listBoxPriceCents: resolved.boxPriceCents,
        costUnitCents,
        marginPercent: marginPercent(item.unitPriceCents, costUnitCents),
      });
    }),
  );

  const { subtotalCents } = computeOrderTotals(
    items,
    order.discountCents,
    order.freightCents ?? 0,
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
  };
}
