import { NextResponse } from "next/server";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
} from "@/lib/i18n/locale";

export async function POST(request: Request) {
  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const locale = body.locale;
  if (!locale || !(LOCALES as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "Geçersiz dil." }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale as Locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export async function GET() {
  return NextResponse.json({
    locales: LOCALES,
    default: DEFAULT_LOCALE,
  });
}
