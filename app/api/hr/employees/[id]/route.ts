import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { recordAudit } from "@/lib/audit/service";
import { getEmployee, updateEmployee } from "@/lib/hr/service";
import { serializeEmployee } from "@/lib/hr/serialize";
import { formatBrlFromCents } from "@/lib/stock/constants";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("hr", "view");
  if (auth.error) return auth.error;

  const { id } = await params;
  const employee = await getEmployee(prisma, id);
  if (!employee) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ employee: serializeEmployee(employee) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("hr", "edit");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const existing = await getEmployee(prisma, id);
    if (!existing) {
      return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (body.name !== undefined) patch.name = String(body.name);
    if (body.role !== undefined) patch.role = body.role ? String(body.role) : null;
    if (body.department !== undefined) patch.department = body.department ? String(body.department) : null;
    if (body.monthlySalaryCents !== undefined) {
      patch.monthlySalaryCents = Math.round(Number(body.monthlySalaryCents) || 0);
    }
    if (body.hourlyRateCents !== undefined) {
      patch.hourlyRateCents = Math.round(Number(body.hourlyRateCents) || 0);
    }
    if (body.overtimeMultiplier !== undefined) {
      patch.overtimeMultiplier = Number(body.overtimeMultiplier) || 1.5;
    }
    if (body.shift !== undefined) patch.shift = body.shift ? String(body.shift) : null;
    if (body.startDate !== undefined) patch.startDate = body.startDate ? String(body.startDate) : null;
    if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone) : null;
    if (body.email !== undefined) patch.email = body.email ? String(body.email) : null;
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);

    const employee = await updateEmployee(prisma, id, patch);

    if (
      patch.monthlySalaryCents !== undefined &&
      patch.monthlySalaryCents !== existing.monthlySalaryCents
    ) {
      await recordAudit(prisma, {
        userId: auth.session.userId,
        entityType: "employee",
        entityId: id,
        action: "update",
        changes: [
          {
            field: "monthlySalaryCents",
            oldValue: formatBrlFromCents(existing.monthlySalaryCents),
            newValue: formatBrlFromCents(employee.monthlySalaryCents),
          },
        ],
      });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Güncelleme başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
