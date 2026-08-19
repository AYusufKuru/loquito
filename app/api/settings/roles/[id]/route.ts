import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { PERMISSIONS_TAG } from "@/lib/cache/server";
import { prisma } from "@/lib/prisma";
import { buildPermissionRows, parsePermissionInput } from "@/lib/settings/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("settings", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const existing = await prisma.role.findUnique({
      where: { id },
      include: { permissions: true, users: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Rol bulunamadı." }, { status: 404 });
    }

    const data: { name?: string; description?: string | null } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      const name = body.name.trim();
      const duplicate = await prisma.role.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Bu rol adı zaten kullanılıyor." },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if (typeof body.description === "string") {
      data.description = body.description.trim() || null;
    }

    let permissions = existing.permissions;
    if (body.permissions !== undefined) {
      const parsed = parsePermissionInput(body.permissions);
      if (!parsed) {
        return NextResponse.json(
          { error: "Geçersiz yetki matrisi." },
          { status: 400 },
        );
      }

      await prisma.$transaction(
        parsed.map((perm) =>
          prisma.permission.upsert({
            where: {
              roleId_module: { roleId: id, module: perm.module },
            },
            create: {
              roleId: id,
              module: perm.module,
              canView: perm.canView,
              canCreate: perm.canCreate,
              canEdit: perm.canEdit,
              canDelete: perm.canDelete,
              canApprove: perm.canApprove,
            },
            update: {
              canView: perm.canView,
              canCreate: perm.canCreate,
              canEdit: perm.canEdit,
              canDelete: perm.canDelete,
              canApprove: perm.canApprove,
            },
          }),
        ),
      );

      permissions = await prisma.permission.findMany({ where: { roleId: id } });
      revalidateTag(PERMISSIONS_TAG);
    }

    const role = await prisma.role.update({
      where: { id },
      data,
      include: {
        permissions: true,
        users: { select: { id: true } },
      },
    });

    return NextResponse.json({
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role.users.length,
        permissions: buildPermissionRows(permissions),
      },
    });
  } catch {
    return NextResponse.json({ error: "Rol güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiPermission("settings", "delete");
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const role = await prisma.role.findUnique({
    where: { id },
    include: { users: { select: { id: true } } },
  });

  if (!role) {
    return NextResponse.json({ error: "Rol bulunamadı." }, { status: 404 });
  }

  if (role.isSystem) {
    return NextResponse.json(
      { error: "Sistem rolleri silinemez." },
      { status: 400 },
    );
  }

  if (role.users.length > 0) {
    return NextResponse.json(
      { error: "Bu role atanmış kullanıcılar var. Önce kullanıcıları başka role taşıyın." },
      { status: 400 },
    );
  }

  await prisma.role.delete({ where: { id } });
  revalidateTag(PERMISSIONS_TAG);

  return NextResponse.json({ success: true });
}
