import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

import { SESSION_MAX_AGE_SECONDS } from "./constants";
import type { SessionPayload } from "./types";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET ortam değişkeni tanımlı değil veya 32 karakterden kısa.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.roleId !== "string" ||
      typeof payload.roleName !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      roleId: payload.roleId,
      roleName: payload.roleName,
      canSetPrice: Boolean(payload.canSetPrice),
      canApproveOrder: Boolean(payload.canApproveOrder),
      canApproveFinance: Boolean(payload.canApproveFinance),
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
