import { MODULE_IDS, type ModuleId } from "@/lib/modules";
import type { PermissionRow } from "@/lib/settings/types";

interface DbPermission {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export function buildPermissionRows(rows: DbPermission[]): PermissionRow[] {
  const map = new Map(rows.map((r) => [r.module, r]));

  return MODULE_IDS.map((moduleId) => {
    const row = map.get(moduleId);
    return {
      module: moduleId,
      canView: row?.canView ?? false,
      canCreate: row?.canCreate ?? false,
      canEdit: row?.canEdit ?? false,
      canDelete: row?.canDelete ?? false,
      canApprove: row?.canApprove ?? false,
    };
  });
}

export function parsePermissionInput(
  input: unknown,
): PermissionRow[] | null {
  if (!Array.isArray(input)) return null;

  const result: PermissionRow[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const moduleId = (item as { module?: string }).module;
    if (!moduleId || !MODULE_IDS.includes(moduleId as ModuleId)) return null;

    const row = item as Record<string, unknown>;
    result.push({
      module: moduleId as ModuleId,
      canView: Boolean(row.canView),
      canCreate: Boolean(row.canCreate),
      canEdit: Boolean(row.canEdit),
      canDelete: Boolean(row.canDelete),
      canApprove: Boolean(row.canApprove),
    });
  }

  return result;
}
