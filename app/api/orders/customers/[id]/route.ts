import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  toChannelCodeRow,
  toCustomerPriceRow,
  toCustomerRow,
  toPriceTierRow,
} from "@/lib/pricing/serialize";

type RouteContext = { params: Promise<{ id: string }> };

async function loadCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      salesRep: { select: { name: true } },
      priceList: { select: { name: true } },
      customerPrices: {
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      priceTiers: {
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { thresholdQty: "asc" },
      },
      channelCodes: {
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { externalSku: "asc" },
      },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "view");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const customer = await loadCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({
    customer: toCustomerRow(customer),
    customerPrices: customer.customerPrices.map(toCustomerPriceRow),
    priceTiers: customer.priceTiers.map(toPriceTierRow),
    channelCodes: customer.channelCodes.map(toChannelCodeRow),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    }

    const body = await request.json();

    await prisma.customer.update({
      where: { id },
      data: {
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name.trim()
            : existing.name,
        cnpj:
          typeof body.cnpj === "string" ? body.cnpj.trim() || null : existing.cnpj,
        region:
          typeof body.region === "string" ? body.region.trim() || null : existing.region,
        salesRepId:
          body.salesRepId === null || body.salesRepId === ""
            ? null
            : typeof body.salesRepId === "string"
              ? body.salesRepId
              : existing.salesRepId,
        priceListId:
          body.priceListId === null || body.priceListId === ""
            ? null
            : typeof body.priceListId === "string"
              ? body.priceListId
              : existing.priceListId,
        paymentTerms:
          typeof body.paymentTerms === "string"
            ? body.paymentTerms.trim() || null
            : existing.paymentTerms,
        freightType:
          typeof body.freightType === "string"
            ? body.freightType.trim() || null
            : existing.freightType,
        address:
          typeof body.address === "string" ? body.address.trim() || null : existing.address,
        deliveryAddress:
          typeof body.deliveryAddress === "string"
            ? body.deliveryAddress.trim() || null
            : existing.deliveryAddress,
        billingAddress:
          typeof body.billingAddress === "string"
            ? body.billingAddress.trim() || null
            : existing.billingAddress,
        phone:
          typeof body.phone === "string" ? body.phone.trim() || null : existing.phone,
        email:
          typeof body.email === "string" ? body.email.trim() || null : existing.email,
        contactName:
          typeof body.contactName === "string"
            ? body.contactName.trim() || null
            : existing.contactName,
        notes:
          typeof body.notes === "string" ? body.notes.trim() || null : existing.notes,
        isActive:
          typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      },
    });

    const full = await loadCustomer(id);
    if (!full) {
      return NextResponse.json({ error: "Müşteri güncellenemedi." }, { status: 500 });
    }

    return NextResponse.json({
      customer: toCustomerRow(full),
      customerPrices: full.customerPrices.map(toCustomerPriceRow),
      priceTiers: full.priceTiers.map(toPriceTierRow),
      channelCodes: full.channelCodes.map(toChannelCodeRow),
    });
  } catch {
    return NextResponse.json({ error: "Müşteri güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("orders", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const orderCount = await prisma.order.count({ where: { customerId: id } });
  if (orderCount > 0) {
    await prisma.customer.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
