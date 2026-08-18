import type { PrismaClient } from "@prisma/client";

import type { PriceSource, QuantityUnit, ResolvedPrice } from "./types";

type Db = PrismaClient;

/**
 * Geçerlilik aralığı her iki uçta da dahildir. `validTo` çoğunlukla gece
 * yarısı olarak kaydedildiği için son gün boyunca geçerli sayılır.
 */
function isWithinRange(
  asOf: Date,
  validFrom: Date | null,
  validTo: Date | null,
): boolean {
  if (validFrom && asOf < validFrom) return false;
  if (validTo) {
    const endOfDay = new Date(validTo);
    endOfDay.setHours(23, 59, 59, 999);
    if (asOf > endOfDay) return false;
  }
  return true;
}

function applyDiscount(cents: number, discountPercent: number | null): number {
  if (!discountPercent || discountPercent <= 0) return cents;
  return Math.round(cents * (1 - discountPercent / 100));
}

async function getListItemPrice(
  db: Db,
  priceListId: string,
  productId: string,
): Promise<{ boxPriceCents: number; unitPriceCents: number } | null> {
  const item = await db.priceListItem.findUnique({
    where: { priceListId_productId: { priceListId, productId } },
  });
  if (!item) return null;
  return {
    boxPriceCents: item.boxPriceCents,
    unitPriceCents: item.unitPriceCents,
  };
}

async function getActivePriceList(
  db: Db,
  priceListId: string | null,
  asOf: Date,
): Promise<{ id: string; name: string } | null> {
  if (priceListId) {
    const list = await db.priceList.findUnique({ where: { id: priceListId } });
    if (
      list &&
      list.isActive &&
      isWithinRange(asOf, list.validFrom, list.validTo)
    ) {
      return { id: list.id, name: list.name };
    }
  }
  return null;
}

async function getDefaultPriceList(db: Db, asOf: Date) {
  const lists = await db.priceList.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  for (const list of lists) {
    if (isWithinRange(asOf, list.validFrom, list.validTo)) {
      return { id: list.id, name: list.name };
    }
  }
  return null;
}

export async function resolvePrice(
  db: Db,
  customerId: string,
  productId: string,
  quantity: number,
  quantityUnit: QuantityUnit,
  asOf: Date = new Date(),
): Promise<ResolvedPrice> {
  const empty: ResolvedPrice = {
    productId,
    customerId,
    boxPriceCents: null,
    unitPriceCents: null,
    source: "none",
    sourceDetail: null,
    quantity,
    quantityUnit,
  };

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { priceListId: true },
  });
  if (!customer) return empty;

  const customerPrice = await db.customerPrice.findFirst({
    where: {
      customerId,
      productId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (
    customerPrice &&
    isWithinRange(asOf, customerPrice.validFrom, customerPrice.validTo)
  ) {
    return {
      productId,
      customerId,
      boxPriceCents: customerPrice.boxPriceCents,
      unitPriceCents: customerPrice.unitPriceCents,
      source: "customer_price",
      sourceDetail: "Müşteriye özel fiyat",
      quantity,
      quantityUnit,
    };
  }

  const tiers = await db.priceTier.findMany({
    where: {
      customerId,
      OR: [{ productId }, { productId: null }],
      thresholdUnit: quantityUnit,
      thresholdQty: { lte: quantity },
    },
    // Ürüne özel kademe, aynı eşikteki genel kademeden önce gelir.
    orderBy: [{ thresholdQty: "desc" }, { productId: "desc" }],
  });

  const tier = tiers[0];
  if (tier) {
    if (tier.boxPriceCents != null || tier.unitPriceCents != null) {
      return {
        productId,
        customerId,
        boxPriceCents: tier.boxPriceCents,
        unitPriceCents: tier.unitPriceCents,
        source: "price_tier",
        sourceDetail: `Kademe ≥ ${tier.thresholdQty} ${tier.thresholdUnit}`,
        quantity,
        quantityUnit,
      };
    }

    if (tier.discountPercent != null && tier.discountPercent > 0) {
      const customerList = await getActivePriceList(
        db,
        customer.priceListId,
        asOf,
      );
      const list =
        customerList ?? (await getDefaultPriceList(db, asOf));
      if (list) {
        const base = await getListItemPrice(db, list.id, productId);
        if (base) {
          return {
            productId,
            customerId,
            boxPriceCents: applyDiscount(
              base.boxPriceCents,
              tier.discountPercent,
            ),
            unitPriceCents: applyDiscount(
              base.unitPriceCents,
              tier.discountPercent,
            ),
            source: "price_tier",
            sourceDetail: `Kademe indirimi ${tier.discountPercent}% (≥ ${tier.thresholdQty})`,
            quantity,
            quantityUnit,
          };
        }
      }
    }
  }

  const customerList = await getActivePriceList(
    db,
    customer.priceListId,
    asOf,
  );
  if (customerList) {
    const base = await getListItemPrice(db, customerList.id, productId);
    if (base) {
      return {
        productId,
        customerId,
        boxPriceCents: base.boxPriceCents,
        unitPriceCents: base.unitPriceCents,
        source: "price_list",
        sourceDetail: customerList.name,
        quantity,
        quantityUnit,
      };
    }
  }

  const defaultList = await getDefaultPriceList(db, asOf);
  if (defaultList) {
    const base = await getListItemPrice(db, defaultList.id, productId);
    if (base) {
      return {
        productId,
        customerId,
        boxPriceCents: base.boxPriceCents,
        unitPriceCents: base.unitPriceCents,
        source: "default_list",
        sourceDetail: defaultList.name,
        quantity,
        quantityUnit,
      };
    }
  }

  return empty;
}

export function priceSourceLabel(source: PriceSource): string {
  switch (source) {
    case "customer_price":
      return "Müşteri özel";
    case "price_tier":
      return "Miktar kademesi";
    case "price_list":
      return "Fiyat listesi";
    case "default_list":
      return "Varsayılan liste";
    default:
      return "Tanımsız";
  }
}
