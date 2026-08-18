import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import { AUTH_COOKIE_NAME } from "./constants";
import { verifySessionToken } from "./jwt";
import type { SessionPayload } from "./types";

/**
 * Oturumu çözer ve kullanıcıyı veritabanından tazeler.
 *
 * Token 7 gün geçerli olduğu için içindeki rol ve yetki bayraklarına
 * güvenilemez: yönetici rolü değiştirdiğinde ya da kullanıcıyı pasife
 * aldığında değişikliğin anında etkili olması gerekir.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: { select: { id: true, name: true } } },
  });

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
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Oturum gerekli");
  }
  return session;
}
