import { SettingsManager } from "@/components/settings/settings-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import { t } from "@/lib/i18n";
import { MODULE_CONFIG } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { buildPermissionRows } from "@/lib/settings/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function SettingsPage() {
  const { session, permissions } = await requireModuleAccess("settings");

  const capabilities = {
    canCreate: hasPermission(permissions, "settings", "create"),
    canEdit: hasPermission(permissions, "settings", "edit"),
    canDelete: hasPermission(permissions, "settings", "delete"),
  };

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: { role: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      include: {
        permissions: true,
        users: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const navLabels: Record<string, string> = {};
  for (const mod of MODULE_CONFIG) {
    navLabels[mod.labelKey] = t(mod.labelKey as Parameters<typeof t>[0]);
  }

  const auditLabels: Record<string, string> = {
    logTitle: t("audit.logTitle"),
    logDesc: t("audit.logDesc"),
    filterEntityType: t("audit.filterEntityType"),
    filterField: t("audit.filterField"),
    filterFieldPlaceholder: t("audit.filterFieldPlaceholder"),
    filterFrom: t("audit.filterFrom"),
    filterTo: t("audit.filterTo"),
    allTypes: t("audit.allTypes"),
    noLogs: t("audit.noLogs"),
    loading: t("audit.loading"),
    loadError: t("audit.loadError"),
    connectionError: t("audit.connectionError"),
    refresh: t("audit.refresh"),
    systemUser: t("audit.systemUser"),
    entity_order: t("audit.entity_order"),
    entity_recipe: t("audit.entity_recipe"),
    entity_price_list: t("audit.entity_price_list"),
    entity_customer_price: t("audit.entity_customer_price"),
    entity_customer: t("audit.entity_customer"),
    entity_shipment: t("audit.entity_shipment"),
    entity_user: t("audit.entity_user"),
    entity_employee: t("audit.entity_employee"),
  };

  const labels = {
    ...navLabels,
    title: t("modules.settings.title"),
    description: t("modules.settings.description"),
    usersTab: t("settings.usersTab"),
    rolesTab: t("settings.rolesTab"),
    factoryTab: t("settings.factoryTab"),
    notificationsTab: t("settings.notificationsTab"),
    auditTab: t("settings.auditTab"),
  };

  const factoryLabels: Record<string, string> = {
    title: t("settings.factoryTitle"),
    desc: t("settings.factoryDesc"),
    save: t("settings.factorySave"),
    saveAndSync: t("settings.factorySaveAndSync"),
    syncLines: t("settings.factorySyncLines"),
    saveSuccess: t("settings.factorySaveSuccess"),
    saveError: t("settings.factorySaveError"),
    syncSuccess: t("settings.factorySyncSuccess"),
    syncError: t("settings.factorySyncError"),
    factoryHint: t("settings.factoryHint"),
    linesTitle: t("settings.factoryLinesTitle"),
    linesDesc: t("settings.factoryLinesDesc"),
    lineCode: t("settings.factoryLineCode"),
    lineType: t("settings.factoryLineType"),
    teamSize: t("settings.factoryTeamSize"),
    dailyTarget: t("settings.factoryDailyTarget"),
    dailyProduced: t("settings.factoryDailyProduced"),
    noLines: t("settings.factoryNoLines"),
    yes: t("settings.factoryYes"),
    no: t("settings.factoryNo"),
    lineType_cooker: t("settings.factoryLineType_cooker"),
    lineType_cutting: t("settings.factoryLineType_cutting"),
    lineType_packaging: t("settings.factoryLineType_packaging"),
    categoryDesc_schedule: t("settings.factoryCategoryDesc_schedule"),
    categoryDesc_production: t("settings.factoryCategoryDesc_production"),
    categoryDesc_finance: t("settings.factoryCategoryDesc_finance"),
    categoryDesc_company: t("settings.factoryCategoryDesc_company"),
    categoryDesc_general: t("settings.factoryCategoryDesc_general"),
    loading: t("audit.loading"),
    loadError: t("audit.loadError"),
    saving: t("audit.loading"),
  };

  const notificationLabels: Record<string, string> = {
    title: t("settings.notificationsTitle"),
    desc: t("settings.notificationsDesc"),
    enabled: t("settings.notificationsEnabled"),
    disabled: t("settings.notificationsDisabled"),
    emailPlaceholder: t("settings.notificationsEmailPlaceholder"),
    save: t("settings.notificationsSave"),
    saveSuccess: t("settings.notificationsSaveSuccess"),
    saveError: t("settings.notificationsSaveError"),
    disclaimer: t("settings.notificationsDisclaimer"),
    notifyDesc_notify_stock_critical: t("settings.notifyDesc_notify_stock_critical"),
    notifyDesc_notify_payment_overdue: t("settings.notifyDesc_notify_payment_overdue"),
    notifyDesc_notify_delivery_delayed: t("settings.notifyDesc_notify_delivery_delayed"),
    notifyDesc_notify_production_downtime: t("settings.notifyDesc_notify_production_downtime"),
    notifyDesc_notify_email_enabled: t("settings.notifyDesc_notify_email_enabled"),
    notifyDesc_notify_email_address: t("settings.notifyDesc_notify_email_address"),
    loading: t("audit.loading"),
    loadError: t("audit.loadError"),
    saving: t("audit.loading"),
  };

  return (
    <SettingsManager
      initialUsers={users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        roleId: user.roleId,
        roleName: user.role.name,
        canSetPrice: user.canSetPrice,
        canApproveOrder: user.canApproveOrder,
        canApproveFinance: user.canApproveFinance,
      }))}
      initialRoles={roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role.users.length,
        permissions: buildPermissionRows(role.permissions),
      }))}
      labels={labels}
      auditLabels={auditLabels}
      factoryLabels={factoryLabels}
      notificationLabels={notificationLabels}
      capabilities={capabilities}
      currentUserId={session.userId}
    />
  );
}
