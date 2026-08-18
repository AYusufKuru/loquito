import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { listInboxMessages, syncGmailInbox } from "@/lib/gmail/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  const messages = await listInboxMessages(prisma);
  return NextResponse.json({ messages });
}

export async function POST() {
  const auth = await requireApiPermission("ai", "create");
  if (auth.error) return auth.error;

  try {
    const result = await syncGmailInbox(prisma);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gmail senkronizasyonu başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
