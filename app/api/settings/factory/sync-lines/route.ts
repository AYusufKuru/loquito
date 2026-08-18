import { NextResponse } from "next/server";

import { syncLineTargetsFromSettings } from "@/lib/factory/settings-service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const auth = await requireApiPermission("settings", "edit");
  if (auth.error) return auth.error;

  await syncLineTargetsFromSettings(prisma);
  return NextResponse.json({ ok: true });
}
