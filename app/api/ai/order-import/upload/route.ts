import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { assertAllowedUpload, saveUploadedFile } from "@/lib/files/storage";
import { parseOrderDocumentBuffer } from "@/lib/ocr/service";
import type { OrderChannel } from "@/lib/orders/constants";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiPermission("ai", "create");
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }

    const fileName = file.name || "upload.txt";
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

    const importId = randomUUID();
    const saved = await saveUploadedFile(
      `order-imports/${importId}`,
      buffer,
      fileName,
    );

    const draft = await parseOrderDocumentBuffer(
      prisma,
      buffer,
      fileName,
      { channel: channelHint, customerId },
    );

    return NextResponse.json({
      importId,
      fileName: saved.fileName,
      fileType: file.type || "application/octet-stream",
      previewUrl: `/api/ai/order-import/${importId}/file`,
      storedPath: saved.filePath,
      draft,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dosya işlenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
