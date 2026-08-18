import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  computeEmployeeSummary,
  createEmployee,
  listEmployees,
} from "@/lib/hr/service";
import { serializeEmployee } from "@/lib/hr/serialize";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("hr", "view");
  if (auth.error) return auth.error;

  const [employees, summary] = await Promise.all([
    listEmployees(prisma),
    computeEmployeeSummary(prisma),
  ]);

  return NextResponse.json({
    employees: employees.map(serializeEmployee),
    summary,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("hr", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";

    const employee = await createEmployee(prisma, {
      name,
      role: typeof body.role === "string" ? body.role : null,
      department: typeof body.department === "string" ? body.department : null,
      monthlySalaryCents: Math.round(Number(body.monthlySalaryCents) || 0),
      hourlyRateCents:
        body.hourlyRateCents != null ? Math.round(Number(body.hourlyRateCents) || 0) : undefined,
      overtimeMultiplier: Number(body.overtimeMultiplier) || undefined,
      shift: typeof body.shift === "string" ? body.shift : null,
      startDate: typeof body.startDate === "string" ? body.startDate : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      email: typeof body.email === "string" ? body.email : null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Personel oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
