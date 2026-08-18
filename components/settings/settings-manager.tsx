"use client";

import { useState } from "react";

import { AuditLogSection } from "@/components/audit/audit-log-section";
import { FactorySettingsSection } from "@/components/settings/factory-settings-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { RolesSection } from "@/components/settings/roles-section";
import { UsersSection } from "@/components/settings/users-section";
import { cn } from "@/lib/utils";
import type {
  RoleRow,
  SettingsCapabilities,
  UserRow,
} from "@/lib/settings/types";

type Tab = "users" | "roles" | "factory" | "notifications" | "audit";

interface SettingsManagerProps {
  initialUsers: UserRow[];
  initialRoles: RoleRow[];
  labels: Record<string, string>;
  auditLabels: Record<string, string>;
  factoryLabels: Record<string, string>;
  notificationLabels: Record<string, string>;
  capabilities: SettingsCapabilities;
  currentUserId: string;
}

export function SettingsManager({
  initialUsers,
  initialRoles,
  labels,
  auditLabels,
  factoryLabels,
  notificationLabels,
  capabilities,
  currentUserId,
}: SettingsManagerProps) {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab("users")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "users"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {labels.usersTab ?? "Kullanıcılar"}
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "roles"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {labels.rolesTab ?? "Roller & Yetkiler"}
        </button>
        <button
          type="button"
          onClick={() => setTab("factory")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "factory"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {labels.factoryTab ?? "Fabrika"}
        </button>
        <button
          type="button"
          onClick={() => setTab("notifications")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "notifications"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {labels.notificationsTab ?? "Bildirimler"}
        </button>
        <button
          type="button"
          onClick={() => setTab("audit")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "audit"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {labels.auditTab ?? "Değişiklik logu"}
        </button>
      </div>

      <div className="mt-6">
        {tab === "users" ? (
          <UsersSection
            initialUsers={initialUsers}
            roles={initialRoles}
            currentUserId={currentUserId}
            capabilities={capabilities}
          />
        ) : tab === "roles" ? (
          <RolesSection
            initialRoles={initialRoles}
            labels={labels}
            capabilities={capabilities}
          />
        ) : tab === "factory" ? (
          <FactorySettingsSection
            labels={factoryLabels}
            canEdit={capabilities.canEdit}
          />
        ) : tab === "notifications" ? (
          <NotificationsSection
            labels={notificationLabels}
            canEdit={capabilities.canEdit}
          />
        ) : (
          <AuditLogSection labels={auditLabels} />
        )}
      </div>
    </div>
  );
}
