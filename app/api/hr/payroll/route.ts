import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { computePayrollSummary } from "@/lib/hr/labor";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("hr", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = searchParams.get("month") ?? defaultMonth;

  try {
    const summary = await computePayrollSummary(prisma, month);
    return NextResponse.json({ payroll: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bordro hesaplanamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
