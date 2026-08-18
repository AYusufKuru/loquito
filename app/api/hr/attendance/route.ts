import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { listAttendance, upsertAttendance } from "@/lib/hr/labor";
import { serializeAttendance } from "@/lib/hr/serialize";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("hr", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const employeeId = searchParams.get("employeeId") ?? undefined;

  const rows = await listAttendance(prisma, { from, to, employeeId });
  return NextResponse.json({ attendance: rows.map(serializeAttendance) });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("hr", "edit");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const date = typeof body.date === "string" ? body.date : "";

    if (!employeeId || !date) {
      return NextResponse.json({ error: "Personel ve tarih gerekli." }, { status: 400 });
    }

    const row = await upsertAttendance(prisma, {
      employeeId,
      date,
      clockIn: typeof body.clockIn === "string" ? body.clockIn : null,
      clockOut: typeof body.clockOut === "string" ? body.clockOut : null,
      workedHours: body.workedHours != null ? Number(body.workedHours) : undefined,
      overtimeHours: body.overtimeHours != null ? Number(body.overtimeHours) : undefined,
      status: typeof body.status === "string" ? body.status : "present",
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ attendance: serializeAttendance(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Puantaj kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
