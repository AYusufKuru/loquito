import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toSalesRepRow } from "@/lib/pricing/serialize";

export async function GET() {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const reps = await prisma.salesRep.findMany({
    include: { customers: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ salesReps: reps.map(toSalesRepRow) });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Temsilci adı zorunludur." }, { status: 400 });
    }

    const rep = await prisma.salesRep.create({
      data: {
        name,
        company:
          typeof body.company === "string" && body.company.trim()
            ? body.company.trim()
            : null,
        region:
          typeof body.region === "string" && body.region.trim()
            ? body.region.trim()
            : null,
        address:
          typeof body.address === "string" && body.address.trim()
            ? body.address.trim()
            : null,
        cep:
          typeof body.cep === "string" && body.cep.trim() ? body.cep.trim() : null,
        phone:
          typeof body.phone === "string" && body.phone.trim()
            ? body.phone.trim()
            : null,
        email:
          typeof body.email === "string" && body.email.trim()
            ? body.email.trim()
            : null,
        isActive: body.isActive !== false,
      },
      include: { customers: { select: { id: true } } },
    });

    return NextResponse.json({ salesRep: toSalesRepRow(rep) });
  } catch {
    return NextResponse.json({ error: "Temsilci oluşturulamadı." }, { status: 500 });
  }
}
