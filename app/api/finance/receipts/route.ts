import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { processBradescoUpload } from "@/lib/finance/bank-statements";
import { parseFinanceDocument } from "@/lib/finance/bradesco-parser";
import {
  createReceiptFromUpload,
  linkReceiptToPayment,
  listReceipts,
} from "@/lib/finance/receipts";
import { assertAllowedUpload } from "@/lib/files/storage";
import { extractTextFromBuffer } from "@/lib/ocr/text-extract";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const receipts = await listReceipts(prisma);
  return NextResponse.json({ receipts });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("finance", "create");
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }

    const fileName = file.name;
    assertAllowedUpload(fileName, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());

    const text = extractTextFromBuffer(buffer, fileName);
    if (parseFinanceDocument(text, fileName)) {
      const receipt = await processBradescoUpload(prisma, buffer, fileName);
      return NextResponse.json({ receipt });
    }

    const paymentId =
      typeof form.get("paymentId") === "string"
        ? (form.get("paymentId") as string)
        : null;
    const amountRaw = form.get("amountCents");
    const amountCents =
      amountRaw != null ? Math.round(Number(amountRaw) || 0) : null;

    const receipt = await createReceiptFromUpload(prisma, {
      buffer,
      name: file.name,
    }, {
      paymentId,
      amountCents: amountCents && amountCents > 0 ? amountCents : null,
      counterparty:
        typeof form.get("counterparty") === "string"
          ? (form.get("counterparty") as string)
          : null,
      controlNo:
        typeof form.get("controlNo") === "string"
          ? (form.get("controlNo") as string)
          : null,
      direction:
        typeof form.get("direction") === "string"
          ? (form.get("direction") as string)
          : "in",
    });

    if (paymentId) {
      await linkReceiptToPayment(prisma, receipt.id, paymentId);
    }

    return NextResponse.json({ receipt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dekont yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
