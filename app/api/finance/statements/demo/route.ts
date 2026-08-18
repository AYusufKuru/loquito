import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { loadDemoStatement } from "@/lib/finance/bank-statements";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const auth = await requireApiPermission("finance", "create");
  if (auth.error) return auth.error;

  try {
    const result = await loadDemoStatement(prisma);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Demo ekstre yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
