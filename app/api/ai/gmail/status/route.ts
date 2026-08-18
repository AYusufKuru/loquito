import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { getGmailStatus } from "@/lib/gmail/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  const status = await getGmailStatus(prisma);
  return NextResponse.json({ status });
}
