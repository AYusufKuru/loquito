import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  createFixedExpense,
  listFixedExpenses,
  serializeFixedExpense,
} from "@/lib/finance/service";
import { getMonthlyOverheadPool } from "@/lib/finance/overhead";
import { prisma } from "@/lib/prisma";
import { parseBrlToCents } from "@/lib/stock/constants";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const periodMonth = searchParams.get("month") ?? "";

  if (!periodMonth) {
    return NextResponse.json({ error: "Dönem (month) gerekli." }, { status: 400 });
  }

  const expenses = await listFixedExpenses(prisma, periodMonth);
  const totalCents = await getMonthlyOverheadPool(prisma, periodMonth);

  return NextResponse.json({
    expenses: expenses.map(serializeFixedExpense),
    totalCents,
    periodMonth,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("finance", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const periodMonth =
      typeof body.periodMonth === "string" ? body.periodMonth : "";
    const name = typeof body.name === "string" ? body.name : "";

    let amountCents = 0;
    if (body.amountCents != null) {
      amountCents = Math.round(Number(body.amountCents) || 0);
    } else if (typeof body.amount === "string") {
      const parsed = parseBrlToCents(body.amount);
      if (parsed == null) throw new Error("Geçersiz tutar.");
      amountCents = parsed;
    }

    const expense = await createFixedExpense(
      prisma,
      {
        periodMonth,
        name,
        amountCents,
        category: typeof body.category === "string" ? body.category : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      auth.session.userId,
    );

    return NextResponse.json({ expense: serializeFixedExpense(expense) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gider oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
