import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { buildPackagingTemplate } from "@/lib/recipes/packaging";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("recipes", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const packagingId = searchParams.get("packagingId");

  if (!packagingId) {
    return NextResponse.json({ error: "Gramaj seçimi zorunludur." }, { status: 400 });
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { flavor: { select: { code: true } } },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Reçete bulunamadı." }, { status: 404 });
  }

  const packaging = await prisma.packaging.findUnique({ where: { id: packagingId } });
  if (!packaging) {
    return NextResponse.json({ error: "Geçersiz gramaj." }, { status: 400 });
  }

  const materials = await prisma.material.findMany({
    where: { category: "packaging", isActive: true },
    select: { id: true, code: true, name: true, unit: true, subcategory: true, unitPriceCents: true },
    orderBy: { code: "asc" },
  });

  const template = buildPackagingTemplate(
    recipe.flavor?.code ?? null,
    packaging.code,
    packaging.unitsPerBox,
    materials,
  );

  return NextResponse.json({ items: template });
}
