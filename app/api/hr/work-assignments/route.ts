import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { createWorkAssignment, listWorkAssignments } from "@/lib/hr/labor";
import { serializeWorkAssignment } from "@/lib/hr/serialize";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("hr", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const rows = await listWorkAssignments(prisma, { orderId, from, to });
  return NextResponse.json({
    assignments: rows.map(serializeWorkAssignment),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("hr", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const date = typeof body.date === "string" ? body.date : "";
    const hours = Number(body.hours) || 0;

    if (!employeeId || !date) {
      return NextResponse.json({ error: "Personel ve tarih gerekli." }, { status: 400 });
    }

    const row = await createWorkAssignment(prisma, {
      employeeId,
      productionOrderId:
        typeof body.productionOrderId === "string" ? body.productionOrderId : null,
      lineId: typeof body.lineId === "string" ? body.lineId : null,
      hours,
      date,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ assignment: serializeWorkAssignment(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "İş ataması kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
