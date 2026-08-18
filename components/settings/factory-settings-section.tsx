"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFormErrors } from "@/hooks/use-form-errors";
import {
  buildErrors,
  email,
  parseDecimal,
  parseNonNegativeInt,
  sanitizeDecimalInput,
  sanitizeIntInput,
} from "@/lib/forms/validation";
import {
  CURRENCY_OPTIONS,
  OVERHEAD_METHOD_OPTIONS,
  WORK_DAYS_OPTIONS,
} from "@/lib/factory/defaults";
import type {
  FactorySettingsGroup,
  ProductionLineRow,
} from "@/lib/factory/types";

interface FactorySettingsSectionProps {
  labels: Record<string, string>;
  canEdit: boolean;
}

const NON_NOTIFICATION_CATEGORIES = [
  "schedule",
  "production",
  "finance",
  "company",
  "general",
];

function isBooleanSetting(key: string): boolean {
  return key.startsWith("notify_") && key !== "notify_email_address";
}

function isSelectSetting(key: string): string | null {
  if (key === "work_days") return "work_days";
  if (key === "currency_default") return "currency";
  if (key === "overhead_allocation_method") return "overhead";
  return null;
}

function isNumericSettingKey(key: string): boolean {
  return /_kg|_hours|_days|_boxes|_count|_percent|capacity/.test(key);
}

function isDecimalSettingKey(key: string): boolean {
  return key.includes("hours") || key.includes("percent");
}

export function FactorySettingsSection({
  labels,
  canEdit,
}: FactorySettingsSectionProps) {
  const [groups, setGroups] = useState<FactorySettingsGroup[]>([]);
  const [lines, setLines] = useState<ProductionLineRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [lineEdits, setLineEdits] = useState<
    Record<string, { teamSize: number; dailyTargetUnits: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { showError, showApiError, applyValidationErrors, ErrorModal } = useFormErrors();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [factoryRes, linesRes] = await Promise.all([
        fetch("/api/settings/factory"),
        fetch("/api/settings/lines"),
      ]);
      if (!factoryRes.ok || !linesRes.ok) throw new Error("fetch failed");
      const factoryData = await factoryRes.json();
      const linesData = await linesRes.json();
      setGroups(factoryData.groups ?? []);
      setLines(linesData.lines ?? []);

      const map: Record<string, string> = {};
      for (const group of factoryData.groups ?? []) {
        for (const s of group.settings) {
          map[s.key] = s.value;
        }
      }
      setValues(map);

      const lineMap: Record<string, { teamSize: number; dailyTargetUnits: number }> = {};
      for (const line of linesData.lines ?? []) {
        lineMap[line.id] = {
          teamSize: line.teamSize,
          dailyTargetUnits: line.dailyTargetUnits,
        };
      }
      setLineEdits(lineMap);
    } catch {
      showError(labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError, showError]);

  useEffect(() => {
    load();
  }, [load]);

  function validateBeforeSave(): boolean {
    const entries: Array<[string, string | null | undefined]> = [];

    for (const group of groups) {
      if (!NON_NOTIFICATION_CATEGORIES.includes(group.category)) continue;
      for (const setting of group.settings) {
        if (isSelectSetting(setting.key) || isBooleanSetting(setting.key)) continue;
        if (setting.key === "work_start" || setting.key === "work_end") continue;
        if (!isNumericSettingKey(setting.key)) continue;

        const value = values[setting.key] ?? setting.value;
        const label = setting.label;
        const parsed = isDecimalSettingKey(setting.key)
          ? parseDecimal(value, label, { required: true, min: 0 })
          : parseNonNegativeInt(value, label, true);
        if (parsed.error) {
          entries.push([setting.key, parsed.error]);
        }
      }
    }

    for (const line of lines) {
      const teamSize = lineEdits[line.id]?.teamSize ?? line.teamSize;
      const dailyTarget = lineEdits[line.id]?.dailyTargetUnits ?? line.dailyTargetUnits;
      if (!Number.isInteger(teamSize) || teamSize < 0) {
        entries.push([`line-${line.id}-team`, `${line.code}: Ekip büyüklüğü tam sayı olmalıdır.`]);
      }
      if (!Number.isInteger(dailyTarget) || dailyTarget < 0) {
        entries.push([
          `line-${line.id}-target`,
          `${line.code}: Günlük hedef tam sayı olmalıdır.`,
        ]);
      }
    }

    return applyValidationErrors(buildErrors(entries));
  }

  const save = async (syncLines = false) => {
    if (!canEdit) return;
    if (!validateBeforeSave()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/factory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values, syncLines }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }

      const linePayload = lines.map((line) => ({
        id: line.id,
        teamSize: lineEdits[line.id]?.teamSize ?? line.teamSize,
        dailyTargetUnits: lineEdits[line.id]?.dailyTargetUnits ?? line.dailyTargetUnits,
      }));

      const linesRes = await fetch("/api/settings/lines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: linePayload }),
      });
      const linesData = await linesRes.json();
      if (!linesRes.ok) {
        showApiError(linesData, labels.saveError);
        return;
      }

      setMessage(labels.saveSuccess);
      await load();
    } catch {
      showError(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const syncLinesOnly = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/factory/sync-lines", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, labels.syncError);
        return;
      }
      setMessage(labels.syncSuccess);
      await load();
    } catch {
      showError(labels.syncError);
    } finally {
      setSaving(false);
    }
  };

  const visibleGroups = groups.filter((g) =>
    NON_NOTIFICATION_CATEGORIES.includes(g.category),
  );

  return (
    <>
      {ErrorModal}
      <div className="space-y-6">
      {loading && (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      )}
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}

      {visibleGroups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle className="text-base">{group.label}</CardTitle>
            <CardDescription>
              {labels[`categoryDesc_${group.category}`] ?? ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.settings.map((setting) => {
                const selectType = isSelectSetting(setting.key);
                const boolSetting = isBooleanSetting(setting.key);

                return (
                  <div key={setting.key} className="space-y-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`setting-${setting.key}`}
                    >
                      {setting.label}
                    </label>

                    {selectType === "work_days" ? (
                      <select
                        id={`setting-${setting.key}`}
                        disabled={!canEdit}
                        value={values[setting.key] ?? setting.value}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                        }
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {WORK_DAYS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : selectType === "currency" ? (
                      <select
                        id={`setting-${setting.key}`}
                        disabled={!canEdit}
                        value={values[setting.key] ?? setting.value}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                        }
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {CURRENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : selectType === "overhead" ? (
                      <select
                        id={`setting-${setting.key}`}
                        disabled={!canEdit}
                        value={values[setting.key] ?? setting.value}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                        }
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        {OVERHEAD_METHOD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : boolSetting ? (
                      <select
                        id={`setting-${setting.key}`}
                        disabled={!canEdit}
                        value={values[setting.key] ?? setting.value}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                        }
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <option value="true">{labels.yes}</option>
                        <option value="false">{labels.no}</option>
                      </select>
                    ) : (
                      <input
                        id={`setting-${setting.key}`}
                        type={
                          setting.key === "work_start" || setting.key === "work_end"
                            ? "time"
                            : /_kg|_hours|_days|_boxes|_count|_percent|capacity/.test(
                                  setting.key,
                                )
                              ? "number"
                              : "text"
                        }
                        step={
                          setting.key.includes("hours") || setting.key.includes("percent")
                            ? "0.1"
                            : "1"
                        }
                        disabled={!canEdit}
                        value={values[setting.key] ?? setting.value}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next =
                            setting.key === "work_start" || setting.key === "work_end"
                              ? raw
                              : isDecimalSettingKey(setting.key)
                                ? sanitizeDecimalInput(raw)
                                : isNumericSettingKey(setting.key)
                                  ? sanitizeIntInput(raw)
                                  : raw;
                          setValues((v) => ({ ...v, [setting.key]: next }));
                        }}
                        inputMode={
                          isNumericSettingKey(setting.key)
                            ? isDecimalSettingKey(setting.key)
                              ? "decimal"
                              : "numeric"
                            : undefined
                        }
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.linesTitle}</CardTitle>
          <CardDescription>{labels.linesDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noLines}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">{labels.lineCode}</th>
                  <th className="py-2">{labels.lineType}</th>
                  <th className="py-2">{labels.teamSize}</th>
                  <th className="py-2">{labels.dailyTarget}</th>
                  <th className="py-2">{labels.dailyProduced}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{line.code}</td>
                    <td className="py-2">{labels[`lineType_${line.type}`] ?? line.type}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={lineEdits[line.id]?.teamSize ?? line.teamSize}
                        onChange={(e) => {
                          const next = sanitizeIntInput(e.target.value);
                          setLineEdits((prev) => ({
                            ...prev,
                            [line.id]: {
                              ...prev[line.id],
                              teamSize: next === "" ? 0 : Number.parseInt(next, 10),
                              dailyTargetUnits:
                                prev[line.id]?.dailyTargetUnits ?? line.dailyTargetUnits,
                            },
                          }));
                        }}
                        className="w-20 rounded-md border px-2 py-1"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={lineEdits[line.id]?.dailyTargetUnits ?? line.dailyTargetUnits}
                        onChange={(e) => {
                          const next = sanitizeIntInput(e.target.value);
                          setLineEdits((prev) => ({
                            ...prev,
                            [line.id]: {
                              teamSize: prev[line.id]?.teamSize ?? line.teamSize,
                              dailyTargetUnits:
                                next === "" ? 0 : Number.parseInt(next, 10),
                            },
                          }));
                        }}
                        className="w-24 rounded-md border px-2 py-1"
                      />
                    </td>
                    <td className="py-2">{line.dailyProducedUnits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)} disabled={saving || loading}>
            {saving ? labels.saving : labels.save}
          </Button>
          <Button
            variant="outline"
            onClick={() => save(true)}
            disabled={saving || loading}
          >
            {labels.saveAndSync}
          </Button>
          <Button
            variant="outline"
            onClick={syncLinesOnly}
            disabled={saving || loading}
          >
            {labels.syncLines}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{labels.factoryHint}</p>
    </div>
    </>
  );
}
