import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { getLiveProductionBoard } from "@/lib/production/live";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("production", "view");
  if (auth.error) return auth.error;

  const board = await getLiveProductionBoard(prisma);
  return NextResponse.json({ board });
}
