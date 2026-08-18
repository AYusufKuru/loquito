import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toSalesRepRow } from "@/lib/pricing/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const existing = await prisma.salesRep.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Temsilci bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;

    const rep = await prisma.salesRep.update({
      where: { id },
      data: {
        name,
        company:
          typeof body.company === "string" ? body.company.trim() || null : existing.company,
        region:
          typeof body.region === "string" ? body.region.trim() || null : existing.region,
        address:
          typeof body.address === "string" ? body.address.trim() || null : existing.address,
        cep: typeof body.cep === "string" ? body.cep.trim() || null : existing.cep,
        phone:
          typeof body.phone === "string" ? body.phone.trim() || null : existing.phone,
        email:
          typeof body.email === "string" ? body.email.trim() || null : existing.email,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      },
      include: { customers: { select: { id: true } } },
    });

    return NextResponse.json({ salesRep: toSalesRepRow(rep) });
  } catch {
    return NextResponse.json({ error: "Temsilci güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const count = await prisma.customer.count({ where: { salesRepId: id } });
  if (count > 0) {
    await prisma.salesRep.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await prisma.salesRep.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
