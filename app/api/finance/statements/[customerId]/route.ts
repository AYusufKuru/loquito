import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { buildCustomerStatement } from "@/lib/finance/statements";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const { customerId } = await params;
  const statement = await buildCustomerStatement(prisma, customerId);

  if (!statement) {
    return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ statement });
}
