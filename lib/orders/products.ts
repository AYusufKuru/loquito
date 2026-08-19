import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const productInclude = {
  packaging: true,
} satisfies Prisma.ProductInclude;

export type ProductWithPackaging = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

/** Sipariş kalemlerindeki ürünleri tek sorguda yükler. */
export async function findProductsByIds(
  productIds: string[],
): Promise<Map<string, ProductWithPackaging>> {
  const unique = [...new Set(productIds)];
  const result = new Map<string, ProductWithPackaging>();
  if (unique.length === 0) return result;

  const products = await prisma.product.findMany({
    where: { id: { in: unique } },
    include: productInclude,
  });
  for (const product of products) {
    result.set(product.id, product);
  }
  return result;
}
