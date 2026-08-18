import { NextResponse } from "next/server";

import {
  getFactorySettingsGrouped,
  syncLineTargetsFromSettings,
  updateFactorySettings,
} from "@/lib/factory/settings-service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("settings", "view");
  if (auth.error) return auth.error;

  const groups = await getFactorySettingsGrouped(prisma);
  return NextResponse.json({ groups });
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("settings", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const settings =
      body.settings && typeof body.settings === "object" ? body.settings : null;
    if (!settings) {
      return NextResponse.json({ error: "settings alanı gerekli." }, { status: 400 });
    }

    const changed = await updateFactorySettings(
      prisma,
      settings as Record<string, string>,
      auth.session?.userId,
    );

    if (body.syncLines === true) {
      await syncLineTargetsFromSettings(prisma);
    }

    const groups = await getFactorySettingsGrouped(prisma);
    return NextResponse.json({ changed, groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ayarlar kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
