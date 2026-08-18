import { NextResponse } from "next/server";

import {
  listProductionLines,
  updateProductionLines,
} from "@/lib/factory/settings-service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("settings", "view");
  if (auth.error) return auth.error;

  const lines = await listProductionLines(prisma);
  return NextResponse.json({ lines });
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("settings", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const lines = Array.isArray(body.lines) ? body.lines : null;
    if (!lines) {
      return NextResponse.json({ error: "lines alanı gerekli." }, { status: 400 });
    }

    const updated = await updateProductionLines(
      prisma,
      lines as Array<{ id: string; teamSize?: number; dailyTargetUnits?: number }>,
      auth.session?.userId,
    );

    return NextResponse.json({ lines: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hat ayarları kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
