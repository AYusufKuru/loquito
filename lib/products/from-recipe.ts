import type { Packaging, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

function suggestedSku(
  recipeCode: string,
  flavorCode: string | null,
  packaging: Packaging,
): string {
  if (flavorCode) return `BD-${packaging.netWeightG}-${flavorCode}`;
  return `${recipeCode}-${packaging.code}`;
}

function productName(
  recipeName: string,
  flavorName: string | null,
  packagingLabel: string,
): string {
  return `${flavorName ?? recipeName} ${packagingLabel}`.trim();
}

function productTypeFor(packaging: Packaging): string {
  return packaging.code === "80G" ? "bomonti" : "normal";
}

async function uniqueSku(db: Db, base: string): Promise<string> {
  const taken = await db.product.findUnique({
    where: { sku: base },
    select: { id: true },
  });
  if (!taken) return base;

  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${base}-${n}`;
    const exists = await db.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export function toCatalogProductRow(product: {
  id: string;
  sku: string;
  name: string;
  recipeId: string | null;
  customerId: string | null;
  packagingId: string | null;
  recipe: { code: string; name: string } | null;
  packaging: { label: string; unitsPerBox: number } | null;
}): CatalogProductShape {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    recipeId: product.recipeId,
    recipeCode: product.recipe?.code ?? null,
    recipeName: product.recipe?.name ?? null,
    packagingId: product.packagingId,
    packagingLabel: product.packaging?.label ?? null,
    unitsPerBox: product.packaging?.unitsPerBox ?? 0,
    customerId: product.customerId,
  };
}

type CatalogProductShape = {
  id: string;
  sku: string;
  name: string;
  recipeId: string | null;
  recipeCode: string | null;
  recipeName: string | null;
  packagingId: string | null;
  packagingLabel: string | null;
  unitsPerBox: number;
  customerId: string | null;
};

const productInclude = {
  recipe: { select: { code: true, name: true } },
  packaging: { select: { label: true, unitsPerBox: true } },
} as const;

export async function createProductForRecipePackaging(
  db: Db,
  input: {
    recipeId: string;
    packagingId: string;
    sku?: string | null;
    name?: string | null;
  },
): Promise<{ ok: true; product: CatalogProductShape } | { ok: false; error: string; status: number }> {
  const recipe = await db.recipe.findUnique({
    where: { id: input.recipeId },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      customerId: true,
      flavorId: true,
      flavor: { select: { code: true, namePt: true } },
    },
  });

  if (!recipe) return { ok: false, error: "Reçete bulunamadı.", status: 404 };
  if (!recipe.isActive) {
    return { ok: false, error: "Pasif reçeteye ürün eklenemez.", status: 400 };
  }

  const packaging = await db.packaging.findUnique({
    where: { id: input.packagingId },
  });
  if (!packaging?.isActive || packaging.unitsPerBox <= 0) {
    return { ok: false, error: "Geçersiz gramaj.", status: 400 };
  }

  const duplicate = await db.product.findFirst({
    where: { recipeId: recipe.id, packagingId: packaging.id },
    select: { id: true, sku: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Bu reçete ve gramaj için ürün zaten var (${duplicate.sku}).`,
      status: 400,
    };
  }

  const requestedSku = input.sku?.trim().toUpperCase() ?? "";
  let sku: string;
  if (requestedSku) {
    const taken = await db.product.findUnique({
      where: { sku: requestedSku },
      select: { id: true },
    });
    if (taken) {
      return { ok: false, error: "Bu SKU zaten kullanılıyor.", status: 400 };
    }
    sku = requestedSku;
  } else {
    sku = await uniqueSku(
      db,
      suggestedSku(recipe.code, recipe.flavor?.code ?? null, packaging),
    );
  }

  const name =
    input.name?.trim() ||
    productName(recipe.name, recipe.flavor?.namePt ?? null, packaging.label);

  const product = await db.product.create({
    data: {
      sku,
      name,
      flavorId: recipe.flavorId,
      packagingId: packaging.id,
      productType: productTypeFor(packaging),
      customerId: recipe.customerId,
      recipeId: recipe.id,
    },
    include: productInclude,
  });

  return { ok: true, product: toCatalogProductRow(product) };
}
