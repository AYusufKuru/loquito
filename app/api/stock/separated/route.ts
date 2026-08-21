import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  listSeparatedStock,
  separateFinishedStock,
} from "@/lib/separated-stock/service";

export async function GET() {
  const auth = await requireApiPermission("stock", "view");
  if (auth.error) return auth.error;

  const rows = await listSeparatedStock(prisma);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("stock", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const row = await separateFinishedStock(prisma, {
      stockId: typeof body.stockId === "string" ? body.stockId : "",
      quantity: Number(body.quantity),
      notes: typeof body.notes === "string" ? body.notes : "",
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ayırma başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
