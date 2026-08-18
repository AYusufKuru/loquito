import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginAttempts,
  getDefaultRoute,
  getRolePermissions,
  getSessionCookieOptions,
  hasPermission,
  recordFailedLogin,
  signSessionToken,
  verifyDummyPassword,
  verifyPassword,
} from "@/lib/auth";
import { MODULE_CONFIG } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

function resolveRedirectPath(
  from: string | undefined,
  permissions: Awaited<ReturnType<typeof getRolePermissions>>,
): string {
  const defaultRoute = getDefaultRoute(permissions);

  if (!from || from === "/login") {
    return defaultRoute;
  }

  // Sadece pathname — query string'i ayır
  const pathname = from.split("?")[0];

  const moduleConfig = MODULE_CONFIG.find(
    (m) => pathname === m.path || pathname.startsWith(`${m.path}/`),
  );

  if (moduleConfig && hasPermission(permissions, moduleConfig.id, "view")) {
    return pathname;
  }

  return defaultRoute;
}

function getClientKey(request: Request, email: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const from = typeof body.from === "string" ? body.from : undefined;

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre gereklidir." },
        { status: 400 },
      );
    }

    const rateKey = getClientKey(request, email);
    const limit = checkLoginRateLimit(rateKey);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Çok fazla hatalı deneme. ${Math.ceil(limit.retryAfterSeconds / 60)} dakika sonra tekrar deneyin.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    // Kullanıcı yoksa da bcrypt çalıştırılır: yanıt süresi farkından
    // hesabın var olup olmadığı anlaşılmasın.
    const valid = user?.isActive
      ? await verifyPassword(password, user.passwordHash)
      : await verifyDummyPassword(password);

    if (!user || !user.isActive || !valid) {
      recordFailedLogin(rateKey);
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı." },
        { status: 401 },
      );
    }

    clearLoginAttempts(rateKey);

    const permissions = await getRolePermissions(user.roleId);
    const redirectTo = resolveRedirectPath(from, permissions);

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      canSetPrice: user.canSetPrice,
      canApproveOrder: user.canApproveOrder,
      canApproveFinance: user.canApproveFinance,
    });

    const response = NextResponse.json({
      success: true,
      redirectTo,
      user: {
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Login hatası:", error);
    return NextResponse.json(
      { error: "Giriş işlemi başarısız. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
