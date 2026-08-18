import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { MODULE_IDS } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { buildPermissionRows, parsePermissionInput } from "@/lib/settings/permissions";

export async function GET() {
  const auth = await requireApiPermission("settings", "view");
  if (auth.error) return auth.error;

  const roles = await prisma.role.findMany({
    include: {
      permissions: true,
      users: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role.users.length,
      permissions: buildPermissionRows(role.permissions),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("settings", "create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Rol adı zorunludur." }, { status: 400 });
    }

    const duplicate = await prisma.role.findUnique({ where: { name } });
    if (duplicate) {
      return NextResponse.json(
        { error: "Bu rol adı zaten kullanılıyor." },
        { status: 400 },
      );
    }

    const parsedPermissions = parsePermissionInput(body.permissions);
    const permissionMap = new Map(
      (parsedPermissions ?? []).map((p) => [p.module, p]),
    );

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        permissions: {
          create: MODULE_IDS.map((module) => {
            const perm = permissionMap.get(module);
            return {
              module,
              canView: perm?.canView ?? false,
              canCreate: perm?.canCreate ?? false,
              canEdit: perm?.canEdit ?? false,
              canDelete: perm?.canDelete ?? false,
              canApprove: perm?.canApprove ?? false,
            };
          }),
        },
      },
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
        permissions: buildPermissionRows(role.permissions),
      },
    });
  } catch {
    return NextResponse.json({ error: "Rol oluşturulamadı." }, { status: 500 });
  }
}
