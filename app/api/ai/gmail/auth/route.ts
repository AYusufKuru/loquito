import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { isGmailConfigured } from "@/lib/gmail/config";
import { buildGmailAuthUrl } from "@/lib/gmail/oauth";

export async function GET() {
  const auth = await requireApiPermission("ai", "edit");
  if (auth.error) return auth.error;

  if (!isGmailConfigured()) {
    return NextResponse.json(
      { error: "Gmail API kimlik bilgileri yapılandırılmadı." },
      { status: 400 },
    );
  }

  const authUrl = buildGmailAuthUrl(auth.session.userId);
  return NextResponse.json({ authUrl });
}
