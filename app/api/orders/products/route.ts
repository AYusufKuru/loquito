import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { createProductForRecipePackaging } from "@/lib/products/from-recipe";

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const recipeId = typeof body.recipeId === "string" ? body.recipeId : "";
    const packagingId = typeof body.packagingId === "string" ? body.packagingId : "";
    if (!recipeId) {
      return NextResponse.json({ error: "Reçete seçin." }, { status: 400 });
    }
    if (!packagingId) {
      return NextResponse.json({ error: "Gramaj seçin." }, { status: 400 });
    }

    const result = await createProductForRecipePackaging(prisma, {
      recipeId,
      packagingId,
      sku: typeof body.sku === "string" ? body.sku : null,
      name: typeof body.name === "string" ? body.name : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ product: result.product });
  } catch {
    return NextResponse.json({ error: "Ürün oluşturulamadı." }, { status: 500 });
  }
}
