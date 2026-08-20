import { NextResponse } from "next/server";

import { approvePendingApproval } from "@/lib/approvals/service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("settings", "approve");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    await approvePendingApproval(prisma, {
      id,
      userId: auth.session.userId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onay başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
