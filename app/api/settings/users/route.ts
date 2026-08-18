import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("settings", "view");
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    include: { role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roleId: user.roleId,
      roleName: user.role.name,
      canSetPrice: user.canSetPrice,
      canApproveOrder: user.canApproveOrder,
      canApproveFinance: user.canApproveFinance,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("settings", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roleId = typeof body.roleId === "string" ? body.roleId : "";

    if (!email || !name || !password || !roleId) {
      return NextResponse.json(
        { error: "E-posta, ad, şifre ve rol zorunludur." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalıdır." },
        { status: 400 },
      );
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı." },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        roleId,
        canSetPrice: Boolean(body.canSetPrice),
        canApproveOrder: Boolean(body.canApproveOrder),
        canApproveFinance: Boolean(body.canApproveFinance),
      },
      include: { role: { select: { name: true } } },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        roleId: user.roleId,
        roleName: user.role.name,
        canSetPrice: user.canSetPrice,
        canApproveOrder: user.canApproveOrder,
        canApproveFinance: user.canApproveFinance,
      },
    });
  } catch {
    return NextResponse.json({ error: "Kullanıcı oluşturulamadı." }, { status: 500 });
  }
}
