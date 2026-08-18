import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  getOverheadSummary,
  setOverheadAllocationMethod,
} from "@/lib/finance/overhead";
import { listPeriodSummaries, copyExpensesToMonth } from "@/lib/finance/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? "";
  const compareA = searchParams.get("compareA");
  const compareB = searchParams.get("compareB");

  if (compareA && compareB) {
    const summaries = await listPeriodSummaries(prisma, [compareA, compareB]);
    return NextResponse.json({ summaries });
  }

  if (!month) {
    return NextResponse.json({ error: "Dönem (month) gerekli." }, { status: 400 });
  }

  const summary = await getOverheadSummary(prisma, month);
  return NextResponse.json({ summary });
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("finance", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    if (body.action === "copy_month") {
      const fromMonth = typeof body.fromMonth === "string" ? body.fromMonth : "";
      const toMonth = typeof body.toMonth === "string" ? body.toMonth : "";
      const created = await copyExpensesToMonth(
        prisma,
        fromMonth,
        toMonth,
        auth.session.userId,
      );
      return NextResponse.json({ created, count: created.length });
    }

    const method = body.method === "hours" ? "hours" : "kg";
    await setOverheadAllocationMethod(prisma, method);
    const month =
      typeof body.month === "string" && body.month
        ? body.month
        : new Date().toISOString().slice(0, 7);
    const summary = await getOverheadSummary(prisma, month);

    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Güncelleme başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
