import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  contentTypeForFileName,
  readUploadedFile,
} from "@/lib/files/storage";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return NextResponse.json({ error: "Dekont bulunamadı." }, { status: 404 });
  }

  try {
    const data = await readUploadedFile(receipt.filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForFileName(receipt.fileName),
        "Content-Disposition": `attachment; filename="${receipt.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 404 });
  }
}
