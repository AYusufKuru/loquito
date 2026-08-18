import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      ),
    ]);
    return NextResponse.json({ ok: true, db: "connected" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Veritabanı bağlantısı başarısız";
    return NextResponse.json({ ok: false, db: "error", message }, { status: 503 });
  }
}
