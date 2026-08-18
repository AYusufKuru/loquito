import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { listDemoSamples } from "@/lib/ocr/service";
import type { OrderChannel } from "@/lib/orders/constants";

export async function GET() {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  return NextResponse.json({ samples: listDemoSamples() });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const sampleId = typeof body.sampleId === "string" ? body.sampleId : "";
    if (!sampleId) {
      return NextResponse.json({ error: "sampleId gerekli." }, { status: 400 });
    }

    const { loadDemoSampleText, parseOrderDocumentText } = await import(
      "@/lib/ocr/service"
    );
    const { prisma } = await import("@/lib/prisma");

    const sample = await loadDemoSampleText(sampleId);
    if (!sample) {
      return NextResponse.json({ error: "Örnek bulunamadı." }, { status: 404 });
    }

    const channelOverride =
      typeof body.channel === "string" ? (body.channel as OrderChannel) : undefined;

    const draft = await parseOrderDocumentText(prisma, sample.text, {
      channel: channelOverride ?? sample.channel,
      customerId:
        typeof body.customerId === "string" ? body.customerId : undefined,
    });

    return NextResponse.json({
      fileName: sample.fileName,
      fileType: "text/plain",
      draft,
      isDemo: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Örnek okunamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
