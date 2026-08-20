import { NextResponse } from "next/server";

import { listPendingApprovals } from "@/lib/approvals/service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("settings", "view");
  if (auth.error) return auth.error;

  const pending = await listPendingApprovals(prisma);
  return NextResponse.json({ pending });
}
