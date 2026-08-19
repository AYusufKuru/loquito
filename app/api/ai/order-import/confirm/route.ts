import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  completeUnitBoxPrices,
  computeLineTotalCents,
  computeOrderTotals,
  quantityUnitForChannel,
} from "@/lib/orders/compute";
import { ORDER_STATUSES, UNAPPROVED_STATUSES } from "@/lib/orders/constants";
import { loadOrderDetail } from "@/lib/orders/load";
import { findProductsByIds } from "@/lib/orders/products";
import { resolvePrices } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

interface ConfirmLine {
  productId: string;
  quantityBoxes: number;
  quantityUnits: number;
  unitPriceCents: number;
  boxPriceCents: number;
  discountPercent?: number;
  notes?: string | null;
}

function parseConfirmLines(input: unknown): ConfirmLine[] | null {
  if (!Array.isArray(input)) return null;
  const lines: ConfirmLine[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const productId = typeof r.productId === "string" ? r.productId : "";
    if (!productId) continue;
    const quantityBoxes = Number(r.quantityBoxes) || 0;
    const quantityUnits = Number(r.quantityUnits) || 0;
    const unitPriceCents = Math.round(Number(r.unitPriceCents) || 0);
    const boxPriceCents = Math.round(Number(r.boxPriceCents) || 0);
    if (quantityBoxes <= 0 && quantityUnits <= 0) continue;
    lines.push({
      productId,
      quantityBoxes,
      quantityUnits,
      unitPriceCents,
      boxPriceCents,
      discountPercent: Number(r.discountPercent) || 0,
      notes:
        typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
    });
  }
  return lines.length > 0 ? lines : null;
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    if (!customerId) {
      return NextResponse.json({ error: "Müşteri zorunludur." }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Geçersiz müşteri." }, { status: 400 });
    }

    const lines = parseConfirmLines(body.lines);
    if (!lines) {
      return NextResponse.json(
        { error: "En az bir doğrulanmış kalem gerekli." },
        { status: 400 },
      );
    }

    const channel =
      typeof body.channel === "string" && body.channel
        ? body.channel
        : "retail_form";
    const discountCents = Math.round(Number(body.discountCents) || 0);
    const freightCents = Math.round(Number(body.freightCents) || 0);

    const requestedStatus =
      typeof body.status === "string" &&
      ORDER_STATUSES.includes(body.status as never)
        ? body.status
        : "draft";
    const targetStatus =
      auth.session.canApproveOrder || UNAPPROVED_STATUSES.includes(requestedStatus)
        ? requestedStatus
        : "pending_approval";

    const orderDate =
      typeof body.orderDate === "string" && body.orderDate
        ? new Date(body.orderDate)
        : new Date();

    const products = await findProductsByIds(lines.map((line) => line.productId));
    const quantityUnit = quantityUnitForChannel(channel);
    const prepared = [];
    for (const line of lines) {
      const product = products.get(line.productId);
      if (!product) continue;
      prepared.push({ line, product });
    }

    const resolvedPrices = auth.session.canSetPrice
      ? []
      : await resolvePrices(
          prisma,
          customerId,
          prepared.map(({ line }) => ({
            productId: line.productId,
            quantity:
              quantityUnit === "unit" ? line.quantityUnits : line.quantityBoxes,
            quantityUnit,
          })),
          orderDate,
        );

    const itemRows = prepared.map(({ line, product }, index) => {
      let unitPriceCents = line.unitPriceCents;
      let boxPriceCents = line.boxPriceCents;

      // Belgeden okunan fiyatlar da kullanıcı girdisidir; yetki yoksa
      // fiyat listesinden çözümlenen değer geçerlidir.
      if (!auth.session.canSetPrice) {
        const unitsPerBox = product.packaging?.unitsPerBox ?? 0;
        const resolved = resolvedPrices[index];
        unitPriceCents = resolved?.unitPriceCents ?? unitPriceCents;
        boxPriceCents = resolved?.boxPriceCents ?? boxPriceCents;
        const completed = completeUnitBoxPrices(
          unitPriceCents,
          boxPriceCents,
          unitsPerBox,
        );
        unitPriceCents = completed.unitPriceCents;
        boxPriceCents = completed.boxPriceCents;
      }

      return {
        productId: line.productId,
        quantityBoxes: line.quantityBoxes,
        quantityUnits: line.quantityUnits,
        unitPriceCents,
        boxPriceCents,
        discountPercent: line.discountPercent ?? 0,
        totalCents: computeLineTotalCents(
          line.quantityBoxes,
          boxPriceCents,
          line.discountPercent ?? 0,
        ),
        notes: line.notes,
      };
    });

    if (itemRows.length === 0) {
      return NextResponse.json({ error: "Geçerli kalem yok." }, { status: 400 });
    }

    const { totalCents } = computeOrderTotals(
      itemRows,
      discountCents,
      freightCents,
    );

    const orderNo =
      typeof body.orderNo === "string" && body.orderNo.trim()
        ? body.orderNo.trim()
        : typeof body.referenceNo === "string" && body.referenceNo.trim()
          ? body.referenceNo.trim().replace(/\s+/g, "-")
          : `PED-OCR-${Date.now().toString().slice(-8)}`;

    const existingNo = await prisma.order.findUnique({ where: { orderNo } });
    if (existingNo) {
      return NextResponse.json(
        { error: "Bu sipariş no zaten kullanılıyor." },
        { status: 400 },
      );
    }

    const deliveryDate =
      typeof body.deliveryDate === "string" && body.deliveryDate
        ? new Date(body.deliveryDate)
        : null;

    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId,
        status: targetStatus,
        channel,
        orderDate,
        deliveryDate,
        paymentTerms:
          typeof body.paymentTerms === "string" ? body.paymentTerms : null,
        freightType:
          typeof body.freightType === "string" ? body.freightType : null,
        discountCents,
        freightCents,
        totalCents,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : "OCR ile oluşturuldu",
        items: { create: itemRows },
      },
    });

    // Yalnızca yükleme ucunun ürettiği yol kabul edilir; serbest metin değil.
    const storedPath =
      typeof body.storedPath === "string" ? body.storedPath.trim() : "";
    if (storedPath && /^order-imports\/[\w.\-]+\/[\w.\-]+$/.test(storedPath)) {
      await prisma.orderDocument.create({
        data: {
          orderId: order.id,
          fileName:
            typeof body.fileName === "string" && body.fileName.trim()
              ? body.fileName.trim()
              : storedPath.split("/").pop() ?? "import",
          filePath: storedPath,
          fileType:
            typeof body.fileType === "string" ? body.fileType : null,
        },
      });
    }

    const detail = await loadOrderDetail(order.id);
    return NextResponse.json({ order: detail });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sipariş oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
