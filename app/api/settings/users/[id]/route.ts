import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("settings", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const data: {
      name?: string;
      email?: string;
      roleId?: string;
      isActive?: boolean;
      canSetPrice?: boolean;
      canApproveOrder?: boolean;
      canApproveFinance?: boolean;
      passwordHash?: string;
    } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      const duplicate = await prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Bu e-posta adresi zaten kayıtlı." },
          { status: 400 },
        );
      }
      data.email = email;
    }

    if (typeof body.roleId === "string" && body.roleId !== existing.roleId) {
      // Kendi rolünü değiştirmek yetki yükseltmesine açık kapı bırakır.
      if (id === auth.session.userId) {
        return NextResponse.json(
          { error: "Kendi rolünüzü değiştiremezsiniz." },
          { status: 400 },
        );
      }
      const role = await prisma.role.findUnique({ where: { id: body.roleId } });
      if (!role) {
        return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
      }
      data.roleId = body.roleId;
    }

    if (typeof body.isActive === "boolean") {
      if (id === auth.session!.userId && !body.isActive) {
        return NextResponse.json(
          { error: "Kendi hesabınızı devre dışı bırakamazsınız." },
          { status: 400 },
        );
      }
      data.isActive = body.isActive;
    }

    const grantsSelfNewRight =
      id === auth.session.userId &&
      ((body.canSetPrice === true && !existing.canSetPrice) ||
        (body.canApproveOrder === true && !existing.canApproveOrder) ||
        (body.canApproveFinance === true && !existing.canApproveFinance));

    if (grantsSelfNewRight) {
      return NextResponse.json(
        { error: "Kendinize yeni özel yetki tanımlayamazsınız." },
        { status: 400 },
      );
    }

    if (typeof body.canSetPrice === "boolean") data.canSetPrice = body.canSetPrice;
    if (typeof body.canApproveOrder === "boolean") data.canApproveOrder = body.canApproveOrder;
    if (typeof body.canApproveFinance === "boolean") data.canApproveFinance = body.canApproveFinance;

    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: "Şifre en az 6 karakter olmalıdır." },
          { status: 400 },
        );
      }
      data.passwordHash = await hashPassword(body.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
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
    return NextResponse.json({ error: "Kullanıcı güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("settings", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  if (id === auth.session!.userId) {
    return NextResponse.json(
      { error: "Kendi hesabınızı silemezsiniz." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
