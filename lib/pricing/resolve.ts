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

function listItemKey(priceListId: string, productId: string): string {
  return `${priceListId}:${productId}`;
}

type PriceLine = {
  productId: string;
  quantity: number;
  quantityUnit: QuantityUnit;
};

type LoadedCustomerPrice = {
  productId: string;
  boxPriceCents: number | null;
  unitPriceCents: number | null;
  validFrom: Date | null;
  validTo: Date | null;
};

type LoadedTier = {
  productId: string | null;
  thresholdQty: number;
  thresholdUnit: string;
  discountPercent: number | null;
  boxPriceCents: number | null;
  unitPriceCents: number | null;
};

type PriceContext = {
  customerId: string;
  customerPriceByProduct: Map<string, LoadedCustomerPrice>;
  tiers: LoadedTier[];
  customerList: { id: string; name: string } | null;
  defaultList: { id: string; name: string } | null;
  listItemByKey: Map<string, { boxPriceCents: number; unitPriceCents: number }>;
};

function emptyPrice(customerId: string, line: PriceLine): ResolvedPrice {
  return {
    productId: line.productId,
    customerId,
    boxPriceCents: null,
    unitPriceCents: null,
    source: "none",
    sourceDetail: null,
    quantity: line.quantity,
    quantityUnit: line.quantityUnit,
  };
}

function pickTier(
  tiers: LoadedTier[],
  productId: string,
  quantity: number,
  quantityUnit: QuantityUnit,
): LoadedTier | null {
  const matches = tiers.filter(
    (tier) =>
      (tier.productId === productId || tier.productId === null) &&
      tier.thresholdUnit === quantityUnit &&
      tier.thresholdQty <= quantity,
  );
  matches.sort((a, b) => {
    if (a.thresholdQty !== b.thresholdQty) return b.thresholdQty - a.thresholdQty;
    // PostgreSQL DESC: NULLS FIRST — tekil sorgu sırasıyla aynı.
    if (a.productId === b.productId) return 0;
    if (a.productId == null) return -1;
    if (b.productId == null) return 1;
    return a.productId < b.productId ? 1 : -1;
  });
  return matches[0] ?? null;
}

function resolveLine(
  ctx: PriceContext,
  line: PriceLine,
  asOf: Date,
): ResolvedPrice {
  const empty = emptyPrice(ctx.customerId, line);
  const customerPrice = ctx.customerPriceByProduct.get(line.productId);
  if (
    customerPrice &&
    isWithinRange(asOf, customerPrice.validFrom, customerPrice.validTo)
  ) {
    return {
      ...empty,
      boxPriceCents: customerPrice.boxPriceCents,
      unitPriceCents: customerPrice.unitPriceCents,
      source: "customer_price",
      sourceDetail: "Müşteriye özel fiyat",
    };
  }

  const tier = pickTier(
    ctx.tiers,
    line.productId,
    line.quantity,
    line.quantityUnit,
  );
  if (tier) {
    if (tier.boxPriceCents != null || tier.unitPriceCents != null) {
      return {
        ...empty,
        boxPriceCents: tier.boxPriceCents,
        unitPriceCents: tier.unitPriceCents,
        source: "price_tier",
        sourceDetail: `Kademe ≥ ${tier.thresholdQty} ${tier.thresholdUnit}`,
      };
    }

    if (tier.discountPercent != null && tier.discountPercent > 0) {
      const list = ctx.customerList ?? ctx.defaultList;
      const base = list
        ? ctx.listItemByKey.get(listItemKey(list.id, line.productId))
        : undefined;
      if (base) {
        return {
          ...empty,
          boxPriceCents: applyDiscount(base.boxPriceCents, tier.discountPercent),
          unitPriceCents: applyDiscount(base.unitPriceCents, tier.discountPercent),
          source: "price_tier",
          sourceDetail: `Kademe indirimi ${tier.discountPercent}% (≥ ${tier.thresholdQty})`,
        };
      }
    }
  }

  if (ctx.customerList) {
    const base = ctx.listItemByKey.get(
      listItemKey(ctx.customerList.id, line.productId),
    );
    if (base) {
      return {
        ...empty,
        boxPriceCents: base.boxPriceCents,
        unitPriceCents: base.unitPriceCents,
        source: "price_list",
        sourceDetail: ctx.customerList.name,
      };
    }
  }

  if (ctx.defaultList) {
    const base = ctx.listItemByKey.get(
      listItemKey(ctx.defaultList.id, line.productId),
    );
    if (base) {
      return {
        ...empty,
        boxPriceCents: base.boxPriceCents,
        unitPriceCents: base.unitPriceCents,
        source: "default_list",
        sourceDetail: ctx.defaultList.name,
      };
    }
  }

  return empty;
}

async function loadPriceContext(
  db: Db,
  customerId: string,
  productIds: string[],
  asOf: Date,
): Promise<PriceContext | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { priceListId: true },
  });
  if (!customer) return null;

  const uniqueIds = [...new Set(productIds)];

  const [customerPrices, tiers, customerList, defaultList] = await Promise.all([
    uniqueIds.length > 0
      ? db.customerPrice.findMany({
          where: { customerId, productId: { in: uniqueIds } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.priceTier.findMany({
      where: {
        customerId,
        OR:
          uniqueIds.length > 0
            ? [{ productId: { in: uniqueIds } }, { productId: null }]
            : [{ productId: null }],
      },
    }),
    getActivePriceList(db, customer.priceListId, asOf),
    getDefaultPriceList(db, asOf),
  ]);

  const customerPriceByProduct = new Map<string, LoadedCustomerPrice>();
  for (const row of customerPrices) {
    if (!customerPriceByProduct.has(row.productId)) {
      customerPriceByProduct.set(row.productId, row);
    }
  }

  const listIds = [customerList?.id, defaultList?.id].filter(
    (id): id is string => id != null,
  );
  const listItems =
    listIds.length > 0 && uniqueIds.length > 0
      ? await db.priceListItem.findMany({
          where: {
            priceListId: { in: listIds },
            productId: { in: uniqueIds },
          },
        })
      : [];

  const listItemByKey = new Map<
    string,
    { boxPriceCents: number; unitPriceCents: number }
  >();
  for (const item of listItems) {
    listItemByKey.set(listItemKey(item.priceListId, item.productId), {
      boxPriceCents: item.boxPriceCents,
      unitPriceCents: item.unitPriceCents,
    });
  }

  return {
    customerId,
    customerPriceByProduct,
    tiers,
    customerList,
    defaultList,
    listItemByKey,
  };
}

/**
 * Bir siparişin tüm kalemleri için fiyatı toplu çözer. Tekil `resolvePrice`
 * ile aynı öncelik sırası: müşteri fiyatı → kademe → müşteri listesi → varsayılan.
 */
export async function resolvePrices(
  db: Db,
  customerId: string,
  lines: PriceLine[],
  asOf: Date = new Date(),
): Promise<ResolvedPrice[]> {
  if (lines.length === 0) return [];

  const ctx = await loadPriceContext(
    db,
    customerId,
    lines.map((line) => line.productId),
    asOf,
  );
  if (!ctx) return lines.map((line) => emptyPrice(customerId, line));

  return lines.map((line) => resolveLine(ctx, line, asOf));
}

export async function resolvePrice(
  db: Db,
  customerId: string,
  productId: string,
  quantity: number,
  quantityUnit: QuantityUnit,
  asOf: Date = new Date(),
): Promise<ResolvedPrice> {
  const [resolved] = await resolvePrices(
    db,
    customerId,
    [{ productId, quantity, quantityUnit }],
    asOf,
  );
  return resolved;
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
