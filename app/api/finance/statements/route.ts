import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { assertAllowedUpload } from "@/lib/files/storage";
import {
  listBankStatements,
  listStatementReceipts,
  listUnmatchedReceipts,
  uploadWeeklyStatement,
} from "@/lib/finance/bank-statements";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const unmatchedOnly = searchParams.get("unmatchedOnly") === "true";
  const statementId = searchParams.get("statementId");

  if (unmatchedOnly) {
    const receipts = await listUnmatchedReceipts(prisma);
    return NextResponse.json({ receipts });
  }

  if (statementId) {
    const receipts = await listStatementReceipts(prisma, statementId);
    return NextResponse.json({ receipts });
  }

  const statements = await listBankStatements(prisma);
  const receipts = await listStatementReceipts(prisma);
  return NextResponse.json({ statements, receipts });
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

    assertAllowedUpload(file.name, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadWeeklyStatement(prisma, buffer, file.name);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ekstre yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
