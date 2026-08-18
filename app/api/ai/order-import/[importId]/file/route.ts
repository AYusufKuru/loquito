import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  contentTypeForFileName,
  listUploadedFiles,
  readUploadedFile,
} from "@/lib/files/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> },
) {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  const { importId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(importId)) {
    return NextResponse.json({ error: "Geçersiz belge kimliği." }, { status: 400 });
  }

  try {
    const files = await listUploadedFiles(`order-imports/${importId}`);
    if (files.length === 0) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
    }

    const fileName = files[0];
    const data = await readUploadedFile(`order-imports/${importId}/${fileName}`);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForFileName(fileName),
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 404 });
  }
}
