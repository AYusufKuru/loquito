import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { isGmailConfigured } from "@/lib/gmail/config";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/gmail/oauth";
import { saveGmailConnection } from "@/lib/gmail/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("ai", "edit");
  if (auth.error) {
    return NextResponse.redirect(new URL("/ai?gmail=forbidden", request.url));
  }

  if (!isGmailConfigured()) {
    return NextResponse.redirect(new URL("/ai?gmail=not_configured", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(new URL("/ai?gmail=denied", request.url));
  }

  // state, akışı başlatan kullanıcının kimliğidir; eşleşmezse OAuth CSRF olabilir.
  if (state !== auth.session.userId) {
    return NextResponse.redirect(new URL("/ai?gmail=state_mismatch", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchGoogleEmail(tokens.accessToken);
    await saveGmailConnection(prisma, {
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scope: tokens.scope,
    });

    return NextResponse.redirect(new URL("/ai?gmail=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/ai?gmail=error", request.url));
  }
}
