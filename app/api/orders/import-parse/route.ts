import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { assertAllowedUpload } from "@/lib/files/storage";
import { parseOrderDocumentBuffer } from "@/lib/ocr/service";
import { isScannedOrUnreadablePdf } from "@/lib/ocr/text-extract";
import { draftToOrderForm } from "@/lib/orders/draft-to-form";
import type { OrderChannel } from "@/lib/orders/constants";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiPermission("orders", "create");
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }

    const fileName = file.name || "upload.pdf";
    assertAllowedUpload(fileName, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());
    const channelHint =
      typeof form.get("channel") === "string"
        ? (form.get("channel") as OrderChannel)
        : undefined;
    const customerId =
      typeof form.get("customerId") === "string"
        ? (form.get("customerId") as string)
        : undefined;

    const draft = await parseOrderDocumentBuffer(
      prisma,
      buffer,
      fileName,
      { channel: channelHint, customerId },
    );

    if (isScannedOrUnreadablePdf(draft.rawTextPreview)) {
      return NextResponse.json(
        {
          error:
            "PDF taranmış veya metin içermiyor. Metin tabanlı PDF yükleyin veya Yapay Zekâ → OCR sekmesinden metin yapıştırın.",
          code: "scanned_pdf",
        },
        { status: 422 },
      );
    }

    if (draft.lines.length === 0) {
      return NextResponse.json(
        {
          error: "PDF'den sipariş kalemi okunamadı.",
          code: "no_lines",
          draft,
        },
        { status: 422 },
      );
    }

    const formDraft = draftToOrderForm(draft);

    if (formDraft.lines.length === 0) {
      return NextResponse.json(
        {
          error:
            "Ürün SKU'ları eşlenemedi. Müşteri kartında harici kod eşlemesini kontrol edin.",
          code: "no_resolved_lines",
          draft,
          formDraft,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ draft, formDraft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dosya işlenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
