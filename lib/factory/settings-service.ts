import type { PrismaClient } from "@prisma/client";

import { recordAudit } from "@/lib/audit/service";
import { initLineDailyTargets } from "@/lib/production/track";
import { parseWorkDaysPattern } from "@/lib/production/calendar";

import {
  DEFAULT_FACTORY_SETTINGS,
  FACTORY_SETTING_CATEGORIES,
  FACTORY_SETTING_KEYS,
  type FactorySettingCategory,
} from "./defaults";
import type {
  FactorySettingRow,
  FactorySettingsGroup,
  ProductionLineRow,
  WorkSchedule,
} from "./types";

type Db = PrismaClient;

const CATEGORY_LABELS: Record<FactorySettingCategory, string> = {
  schedule: "Mesai ve çalışma günleri",
  production: "Üretim parametreleri",
  finance: "Para birimi ve vergi",
  company: "Firma bilgileri",
  general: "Genel",
  notifications: "Bildirimler",
};

export async function ensureFactorySettings(db: Db): Promise<void> {
  const existing = await db.factorySetting.findMany({ select: { key: true } });
  const have = new Set(existing.map((r) => r.key));
  const missing = DEFAULT_FACTORY_SETTINGS.filter((s) => !have.has(s.key));
  if (missing.length === 0) return;

  await db.factorySetting.createMany({
    data: missing.map((s) => ({
      key: s.key,
      value: s.value,
      label: s.label,
      category: s.category,
    })),
  });
}

export async function getFactorySettingsGrouped(db: Db): Promise<FactorySettingsGroup[]> {
  await ensureFactorySettings(db);

  const rows = await db.factorySetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
  const map = new Map(rows.map((r) => [r.key, r]));

  const groups: FactorySettingsGroup[] = [];

  for (const category of FACTORY_SETTING_CATEGORIES) {
    const defs = DEFAULT_FACTORY_SETTINGS.filter((d) => d.category === category);
    if (defs.length === 0) continue;

    const settings: FactorySettingRow[] = defs.map((def) => {
      const row = map.get(def.key);
      return {
        key: def.key,
        value: row?.value ?? def.value,
        label: def.label,
        category: def.category,
        updatedAt: row?.updatedAt?.toISOString(),
      };
    });

    groups.push({
      category,
      label: CATEGORY_LABELS[category as FactorySettingCategory] ?? category,
      settings,
    });
  }

  return groups;
}

export async function getNotificationSettings(db: Db): Promise<FactorySettingRow[]> {
  const group = await getFactorySettingsGrouped(db);
  const notifications = group.find((g) => g.category === "notifications");
  return notifications?.settings ?? [];
}

export async function updateFactorySettings(
  db: Db,
  updates: Record<string, string>,
  userId?: string,
): Promise<FactorySettingRow[]> {
  const keys = Object.keys(updates).filter((k) => FACTORY_SETTING_KEYS.has(k));
  if (keys.length === 0) {
    throw new Error("Güncellenecek geçerli ayar yok.");
  }

  const changed: FactorySettingRow[] = [];

  for (const key of keys) {
    const value = String(updates[key]).trim();
    const def = DEFAULT_FACTORY_SETTINGS.find((d) => d.key === key);
    if (!def) continue;

    validateSettingValue(key, value);

    const existing = await db.factorySetting.findUnique({ where: { key } });
    const oldValue = existing?.value ?? def.value;

    if (oldValue === value) continue;

    const row = await db.factorySetting.upsert({
      where: { key },
      create: {
        key,
        value,
        label: def.label,
        category: def.category,
      },
      update: { value },
    });

    changed.push({
      key: row.key,
      value: row.value,
      label: def.label,
      category: row.category,
      updatedAt: row.updatedAt.toISOString(),
    });

    await recordAudit(db, {
      userId,
      entityType: "factory_setting",
      entityId: key,
      action: "update",
      changes: [{ field: key, oldValue, newValue: value }],
    });
  }

  return changed;
}

function validateSettingValue(key: string, value: string): void {
  if (key === "work_days" && !["mon-fri", "all"].includes(value)) {
    throw new Error("Çalışma günleri mon-fri veya all olmalı.");
  }
  if (key === "overhead_allocation_method" && !["kg", "hours"].includes(value)) {
    throw new Error("Genel gider dağıtım yöntemi kg veya hours olmalı.");
  }
  if (key === "currency_default" && !["BRL", "USD", "EUR"].includes(value)) {
    throw new Error("Geçersiz para birimi.");
  }
  if (key.startsWith("notify_") && key !== "notify_email_address") {
    if (!["true", "false"].includes(value)) {
      throw new Error("Bildirim ayarları true veya false olmalı.");
    }
  }
  if (
    [
      "batch_yield_kg",
      "batch_cook_hours",
      "cooling_days",
      "cutting_team_size",
      "reference_order_boxes",
      "reference_order_days",
      "daily_capacity_250g",
      "daily_capacity_85g",
      "kazan_count",
      "default_tax_percent",
    ].includes(key)
  ) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`${key} için geçerli sayı girin.`);
    }
  }
  if (key === "work_start" || key === "work_end") {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw new Error("Saat formatı HH:MM olmalı.");
    }
  }
}

export async function listProductionLines(db: Db): Promise<ProductionLineRow[]> {
  const lines = await db.line.findMany({ orderBy: [{ type: "asc" }, { code: "asc" }] });
  return lines.map((line) => ({
    id: line.id,
    code: line.code,
    name: line.name,
    type: line.type,
    teamSize: line.teamSize,
    dailyTargetUnits: line.dailyTargetUnits,
    dailyProducedUnits: line.dailyProducedUnits,
    status: line.status,
    isActive: line.isActive,
  }));
}

export async function updateProductionLines(
  db: Db,
  updates: Array<{ id: string; teamSize?: number; dailyTargetUnits?: number }>,
  userId?: string,
): Promise<ProductionLineRow[]> {
  const results: ProductionLineRow[] = [];

  for (const item of updates) {
    const existing = await db.line.findUnique({ where: { id: item.id } });
    if (!existing) continue;

    const data: { teamSize?: number; dailyTargetUnits?: number } = {};
    if (item.teamSize != null && Number.isFinite(item.teamSize)) {
      data.teamSize = Math.max(0, Math.round(item.teamSize));
    }
    if (item.dailyTargetUnits != null && Number.isFinite(item.dailyTargetUnits)) {
      data.dailyTargetUnits = Math.max(0, Math.round(item.dailyTargetUnits));
    }
    if (Object.keys(data).length === 0) continue;

    const row = await db.line.update({ where: { id: item.id }, data });

    const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
    if (data.teamSize != null && data.teamSize !== existing.teamSize) {
      changes.push({
        field: "teamSize",
        oldValue: String(existing.teamSize),
        newValue: String(data.teamSize),
      });
    }
    if (data.dailyTargetUnits != null && data.dailyTargetUnits !== existing.dailyTargetUnits) {
      changes.push({
        field: "dailyTargetUnits",
        oldValue: String(existing.dailyTargetUnits),
        newValue: String(data.dailyTargetUnits),
      });
    }

    if (changes.length > 0) {
      await recordAudit(db, {
        userId,
        entityType: "production_line",
        entityId: row.id,
        action: "update",
        changes,
      });
    }

    results.push({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      teamSize: row.teamSize,
      dailyTargetUnits: row.dailyTargetUnits,
      dailyProducedUnits: row.dailyProducedUnits,
      status: row.status,
      isActive: row.isActive,
    });
  }

  return results;
}

export async function syncLineTargetsFromSettings(db: Db): Promise<void> {
  await initLineDailyTargets(db);
}

export async function loadWorkSchedule(db: Db): Promise<WorkSchedule> {
  await ensureFactorySettings(db);
  const rows = await db.factorySetting.findMany({
    where: { key: { in: ["work_start", "work_end", "work_days"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const defs = DEFAULT_FACTORY_SETTINGS;

  return {
    workStart: map.get("work_start") ?? defs.find((d) => d.key === "work_start")!.value,
    workEnd: map.get("work_end") ?? defs.find((d) => d.key === "work_end")!.value,
    workDays: map.get("work_days") ?? defs.find((d) => d.key === "work_days")!.value,
  };
}

export function parseWorkSchedulePattern(schedule: WorkSchedule) {
  return parseWorkDaysPattern(schedule.workDays);
}
