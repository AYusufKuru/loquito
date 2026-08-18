import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

import { AUTH_COOKIE_NAME } from "./constants";
import { verifySessionToken } from "./jwt";
import type { SessionPayload } from "./types";

async function withDbTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Veritabanı zaman aşımı")), ms);
    }),
  ]);
}

async function resolveSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  try {
    const user = await withDbTimeout(
      prisma.user.findUnique({
        where: { id: payload.userId },
        include: { role: { select: { id: true, name: true } } },
      }),
    );

    if (!user || !user.isActive) return null;

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      roleId: user.role.id,
      roleName: user.role.name,
      canSetPrice: user.canSetPrice,
      canApproveOrder: user.canApproveOrder,
      canApproveFinance: user.canApproveFinance,
    };
  } catch (error) {
    console.error("Oturum veritabanı hatası:", error);
    return null;
  }
}

/**
 * Oturumu çözer ve kullanıcıyı veritabanından tazeler.
 * React cache() ile layout + sayfa aynı istekte tek sorgu atar.
 */
export const getSession = cache(resolveSession);

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Oturum gerekli");
  }
  return session;
}
