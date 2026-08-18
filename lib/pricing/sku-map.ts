import type { PrismaClient } from "@prisma/client";

import type { SkuResolution } from "./types";

type Db = PrismaClient;

export async function resolveProductByExternalSku(
  db: Db,
  externalSku: string,
  options?: {
    customerId?: string | null;
    channel?: string | null;
  },
): Promise<SkuResolution | null> {
  const normalized = externalSku.trim().toUpperCase();
  if (!normalized) return null;

  const customerId = options?.customerId ?? null;
  const channel = options?.channel ?? null;

  if (customerId) {
    const customerMatch = await db.productChannelCode.findFirst({
      where: {
        externalSku: normalized,
        customerId,
        ...(channel ? { channel } : {}),
      },
      include: { product: { select: { sku: true, name: true } } },
    });
    if (customerMatch?.product) {
      return {
        productId: customerMatch.productId,
        internalSku: customerMatch.product.sku,
        externalSku: customerMatch.externalSku,
        productName: customerMatch.product.name,
        matchType: "customer_channel",
      };
    }
  }

  const channelMatch = await db.productChannelCode.findFirst({
    where: {
      externalSku: normalized,
      customerId: null,
      ...(channel ? { channel } : {}),
    },
    include: { product: { select: { sku: true, name: true } } },
  });
  if (channelMatch?.product) {
    return {
      productId: channelMatch.productId,
      internalSku: channelMatch.product.sku,
      externalSku: channelMatch.externalSku,
      productName: channelMatch.product.name,
      matchType: "channel",
    };
  }

  if (!channel) {
    const anyMatch = await db.productChannelCode.findFirst({
      where: { externalSku: normalized },
      include: { product: { select: { sku: true, name: true } } },
    });
    if (anyMatch?.product) {
      return {
        productId: anyMatch.productId,
        internalSku: anyMatch.product.sku,
        externalSku: anyMatch.externalSku,
        productName: anyMatch.product.name,
        matchType: anyMatch.customerId ? "customer_channel" : "channel",
      };
    }
  }

  const product = await db.product.findUnique({
    where: { sku: normalized },
    select: { id: true, sku: true, name: true },
  });
  if (product) {
    return {
      productId: product.id,
      internalSku: product.sku,
      externalSku: normalized,
      productName: product.name,
      matchType: "internal",
    };
  }

  return null;
}
