import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { toCustomerRow } from "@/lib/pricing/serialize";

export async function GET() {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const customers = await prisma.customer.findMany({
    include: {
      salesRep: { select: { name: true } },
      priceList: { select: { name: true } },
      customerPrices: { select: { id: true } },
      priceTiers: { select: { id: true } },
      channelCodes: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ customers: customers.map(toCustomerRow) });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Müşteri adı zorunludur." }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        cnpj:
          typeof body.cnpj === "string" && body.cnpj.trim() ? body.cnpj.trim() : null,
        region:
          typeof body.region === "string" && body.region.trim()
            ? body.region.trim()
            : null,
        salesRepId:
          typeof body.salesRepId === "string" && body.salesRepId
            ? body.salesRepId
            : null,
        priceListId:
          typeof body.priceListId === "string" && body.priceListId
            ? body.priceListId
            : null,
        paymentTerms:
          typeof body.paymentTerms === "string" && body.paymentTerms.trim()
            ? body.paymentTerms.trim()
            : null,
        freightType:
          typeof body.freightType === "string" && body.freightType.trim()
            ? body.freightType.trim()
            : null,
        address:
          typeof body.address === "string" && body.address.trim()
            ? body.address.trim()
            : null,
        deliveryAddress:
          typeof body.deliveryAddress === "string" && body.deliveryAddress.trim()
            ? body.deliveryAddress.trim()
            : null,
        billingAddress:
          typeof body.billingAddress === "string" && body.billingAddress.trim()
            ? body.billingAddress.trim()
            : null,
        phone:
          typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        email:
          typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
        contactName:
          typeof body.contactName === "string" && body.contactName.trim()
            ? body.contactName.trim()
            : null,
        notes:
          typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        isActive: body.isActive !== false,
      },
      include: {
        salesRep: { select: { name: true } },
        priceList: { select: { name: true } },
        customerPrices: { select: { id: true } },
        priceTiers: { select: { id: true } },
        channelCodes: { select: { id: true } },
      },
    });

    return NextResponse.json({ customer: toCustomerRow(customer) });
  } catch {
    return NextResponse.json({ error: "Müşteri oluşturulamadı." }, { status: 500 });
  }
}
