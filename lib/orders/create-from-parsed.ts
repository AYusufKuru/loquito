import type { PrismaClient } from "@prisma/client";

import {
  computeLineTotalCents,
  computeOrderTotals,
} from "@/lib/orders/compute";
import type { OrderStatus } from "@/lib/orders/constants";
import type { ParsedOrderDraft } from "@/lib/ocr/types";

type Db = PrismaClient;

export interface CreateOrderFromDraftInput {
  customerId: string;
  draft: ParsedOrderDraft;
  status?: OrderStatus;
  orderNo?: string;
  notes?: string;
  storedPath?: string;
  fileName?: string;
  fileType?: string;
}

export async function createOrderFromParsedDraft(
  db: Db,
  input: CreateOrderFromDraftInput,
) {
  const customer = await db.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) throw new Error("Geçersiz müşteri.");

  const resolvedLines = input.draft.lines.filter(
    (l) => l.skuResolved && l.productId,
  );
  if (resolvedLines.length === 0) {
    throw new Error("İşlenebilir sipariş kalemi yok.");
  }

  const itemRows = resolvedLines.map((line) => ({
    productId: line.productId!,
    quantityBoxes: line.quantityBoxes,
    quantityUnits: line.quantityUnits,
    unitPriceCents: line.unitPriceCents,
    boxPriceCents: line.boxPriceCents,
    discountPercent: line.discountPercent,
    totalCents: computeLineTotalCents(
      line.quantityBoxes,
      line.boxPriceCents,
      line.discountPercent,
    ),
    notes: null,
  }));

  const freightCents = input.draft.freightCents ?? 0;
  const { totalCents } = computeOrderTotals(itemRows, 0, freightCents);

  const orderNo =
    input.orderNo?.trim() ||
    input.draft.referenceNo?.trim().replace(/\s+/g, "-") ||
    `PED-GMAIL-${Date.now().toString().slice(-8)}`;

  const existingNo = await db.order.findUnique({ where: { orderNo } });
  if (existingNo) {
    throw new Error("Bu sipariş no zaten kullanılıyor.");
  }

  const order = await db.order.create({
    data: {
      orderNo,
      customerId: input.customerId,
      status: input.status ?? "draft",
      channel: input.draft.channel,
      orderDate: input.draft.orderDate
        ? new Date(input.draft.orderDate)
        : new Date(),
      deliveryDate: input.draft.deliveryDate
        ? new Date(input.draft.deliveryDate)
        : null,
      paymentTerms: input.draft.paymentTerms ?? customer.paymentTerms,
      freightType: input.draft.freightType ?? customer.freightType,
      freightCents,
      totalCents,
      notes:
        input.notes?.trim() ||
        input.draft.notes ||
        "Gmail / OCR ile oluşturuldu",
      items: { create: itemRows },
    },
  });

  if (input.storedPath?.trim()) {
    await db.orderDocument.create({
      data: {
        orderId: order.id,
        fileName:
          input.fileName?.trim() ||
          input.storedPath.split("/").pop() ||
          "attachment",
        filePath: input.storedPath.trim(),
        fileType: input.fileType ?? null,
      },
    });
  }

  return order;
}
