import { NextResponse } from "next/server";

import type { ModuleId } from "@/lib/modules";

import {
  getRolePermissions,
  hasPermission,
  type PermissionAction,
} from "./permissions";
import { getSession } from "./session";
import type { SessionPayload } from "./types";

type ApiAuthResult =
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse };

export async function requireApiPermission(
  module: ModuleId,
  action: PermissionAction,
): Promise<ApiAuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }),
    };
  }

  const permissions = await getRolePermissions(session.roleId);
  if (!hasPermission(permissions, module, action)) {
    return {
      error: NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 }),
    };
  }

  return { session };
}
