import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { getRolePermissions, hasPermission } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { createTaxLocation, listTaxLocations } from "@/lib/finance/tax-locations";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }
  const permissions = await getRolePermissions(session.roleId);
  const canView =
    hasPermission(permissions, "finance", "view") ||
    hasPermission(permissions, "orders", "view");
  if (!canView) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";
  const rows = await listTaxLocations(prisma, activeOnly);
  return NextResponse.json({ locations: rows });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("finance", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const location = await createTaxLocation(prisma, {
      code: typeof body.code === "string" ? body.code : "",
      name: typeof body.name === "string" ? body.name : null,
      region: typeof body.region === "string" ? body.region : null,
      purchaseTaxPercent:
        body.purchaseTaxPercent === null || body.purchaseTaxPercent === ""
          ? null
          : body.purchaseTaxPercent !== undefined
            ? Number(body.purchaseTaxPercent)
            : null,
      salesTaxPercent: Number(body.salesTaxPercent),
      notes: typeof body.notes === "string" ? body.notes : null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    });
    return NextResponse.json({ location });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Konum oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
