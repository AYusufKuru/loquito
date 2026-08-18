import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { getLiveProductionBoardFresh } from "@/lib/production/live";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiPermission("production", "view");
  if (auth.error) return auth.error;

  const board = await getLiveProductionBoardFresh(prisma);
  return NextResponse.json({ board });
}
