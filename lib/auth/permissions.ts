import { cache } from "react";

import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import { MODULE_IDS, getModuleConfig, type ModuleId } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { getSession } from "./session";
import type { SessionPayload } from "./types";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
}

export type PermissionMap = Record<ModuleId, ModulePermission>;

const emptyPermission = (): ModulePermission => ({
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
});

async function loadRolePermissions(roleId: string): Promise<PermissionMap> {
  return cachedQuery(
    ["role-permissions", roleId],
    async () => {
      const rows = await prisma.permission.findMany({ where: { roleId } });

      const map = Object.fromEntries(
        MODULE_IDS.map((id) => [id, emptyPermission()]),
      ) as PermissionMap;

      for (const row of rows) {
        const moduleId = row.module as ModuleId;
        if (!MODULE_IDS.includes(moduleId)) continue;
        map[moduleId] = {
          view: row.canView,
          create: row.canCreate,
          edit: row.canEdit,
          delete: row.canDelete,
          approve: row.canApprove,
        };
      }

      return map;
    },
    REVALIDATE.permissions,
    ["permissions"],
  );
}

/** İstek içi tekilleştirme + kısa süreli sunucu önbelleği */
export const getRolePermissions = cache(loadRolePermissions);

export function hasPermission(
  permissions: PermissionMap,
  module: ModuleId,
  action: PermissionAction,
): boolean {
  const perm = permissions[module];
  if (!perm) return false;
  switch (action) {
    case "view":
      return perm.view;
    case "create":
      return perm.create;
    case "edit":
      return perm.edit;
    case "delete":
      return perm.delete;
    case "approve":
      return perm.approve;
    default:
      return false;
  }
}

export function getVisibleModules(permissions: PermissionMap): ModuleId[] {
  return MODULE_IDS.filter((id) => permissions[id]?.view);
}

/** Kullanıcının giriş sonrası yönlendirileceği ilk sayfa */
export function getDefaultRoute(permissions: PermissionMap): string {
  if (hasPermission(permissions, "dashboard", "view")) {
    return "/dashboard";
  }
  const visible = getVisibleModules(permissions);
  if (visible.length > 0) {
    const config = getModuleConfig(visible[0]);
    return config?.path ?? "/unauthorized";
  }
  return "/unauthorized";
}

async function redirectUnauthorized(deniedModule: ModuleId) {
  const { redirect } = await import("next/navigation");
  redirect(`/unauthorized?module=${deniedModule}`);
}

export async function requireModuleAccess(
  module: ModuleId,
): Promise<{ session: SessionPayload; permissions: PermissionMap }> {
  const { redirect } = await import("next/navigation");
  const session = await getSession();
  if (!session) {
    redirect("/login");
    throw new Error("Oturum gerekli");
  }

  const permissions = await getRolePermissions(session.roleId);
  if (!hasPermission(permissions, module, "view")) {
    await redirectUnauthorized(module);
    throw new Error("Yetkisiz erişim");
  }

  return { session, permissions };
}
