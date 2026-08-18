import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { parseOrderDocumentText } from "@/lib/ocr/service";
import type { OrderChannel } from "@/lib/orders/constants";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiPermission("ai", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Metin gerekli." }, { status: 400 });
    }

    const channel =
      typeof body.channel === "string"
        ? (body.channel as OrderChannel)
        : undefined;
    const customerId =
      typeof body.customerId === "string" ? body.customerId : undefined;

    const draft = await parseOrderDocumentText(prisma, text, {
      channel,
      customerId,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Metin işlenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
