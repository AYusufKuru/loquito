import { readFile } from "fs/promises";

import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { resolveStoragePath } from "@/lib/files/storage";

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
    const dir = resolveStoragePath(`order-imports/${importId}`);
    const { readdir } = await import("fs/promises");
    const files = await readdir(dir);
    if (files.length === 0) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
    }

    const fileName = files[0];
    const fullPath = resolveStoragePath(
      `order-imports/${importId}/${fileName}`,
    );
    const data = await readFile(fullPath);

    const lower = fileName.toLowerCase();
    let contentType = "application/octet-stream";
    if (lower.endsWith(".pdf")) contentType = "application/pdf";
    else if (lower.endsWith(".txt")) contentType = "text/plain; charset=utf-8";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 404 });
  }
}
