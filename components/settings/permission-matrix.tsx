"use client";

import { MODULE_CONFIG } from "@/lib/modules";
import type { PermissionRow } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { key: "canView" as const, label: "Görüntüle" },
  { key: "canCreate" as const, label: "Ekle" },
  { key: "canEdit" as const, label: "Düzenle" },
  { key: "canDelete" as const, label: "Sil" },
  { key: "canApprove" as const, label: "Onayla" },
];

interface PermissionMatrixProps {
  permissions: PermissionRow[];
  labels: Record<string, string>;
  disabled?: boolean;
  onChange: (permissions: PermissionRow[]) => void;
}

export function PermissionMatrix({
  permissions,
  labels,
  disabled,
  onChange,
}: PermissionMatrixProps) {
  function toggle(module: PermissionRow["module"], key: keyof Omit<PermissionRow, "module">) {
    onChange(
      permissions.map((row) => {
        if (row.module !== module) return row;
        const next = { ...row, [key]: !row[key] };
        if (key !== "canView" && next[key]) {
          next.canView = true;
        }
        if (key === "canView" && !next.canView) {
          next.canCreate = false;
          next.canEdit = false;
          next.canDelete = false;
          next.canApprove = false;
        }
        return next;
      }),
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Modül</th>
            {ACTIONS.map((action) => (
              <th key={action.key} className="px-2 py-2 text-center font-medium">
                {action.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((row) => {
            const config = MODULE_CONFIG.find((m) => m.id === row.module);
            const label = config ? labels[config.labelKey] ?? row.module : row.module;

            return (
              <tr key={row.module} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{label}</td>
                {ACTIONS.map((action) => (
                  <td key={action.key} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      className={cn(
                        "h-4 w-4 rounded border-input accent-primary",
                        disabled && "opacity-50",
                      )}
                      checked={row[action.key]}
                      disabled={disabled}
                      onChange={() => toggle(row.module, action.key)}
                      aria-label={`${label} — ${action.label}`}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
