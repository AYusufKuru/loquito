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
import { buildErrors, email } from "@/lib/forms/validation";
import type { FactorySettingRow } from "@/lib/factory/types";

interface NotificationsSectionProps {
  labels: Record<string, string>;
  canEdit: boolean;
}

export function NotificationsSection({
  labels,
  canEdit,
}: NotificationsSectionProps) {
  const [settings, setSettings] = useState<FactorySettingRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { showError, showApiError, applyValidationErrors, ErrorModal } = useFormErrors();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/factory");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const notificationGroup = (data.groups ?? []).find(
        (g: { category: string }) => g.category === "notifications",
      );
      const rows = notificationGroup?.settings ?? [];
      setSettings(rows);
      const map: Record<string, string> = {};
      for (const s of rows) map[s.key] = s.value;
      setValues(map);
    } catch {
      showError(labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!canEdit) return;

    const emailValue = values.notify_email_address ?? "";
    const emailEnabled = values.notify_email_enabled === "true";
    if (
      !applyValidationErrors(
        buildErrors([
          emailEnabled && emailValue.trim()
            ? ["notify_email_address", email(emailValue, labels.emailPlaceholder)]
            : ["notify_email_address", null],
        ]),
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/factory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
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

  return (
    <>
      {ErrorModal}
      <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          )}
          {message && (
            <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
          )}

          <div className="space-y-3">
            {settings.map((setting) => (
              <div
                key={setting.key}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{setting.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {labels[`notifyDesc_${setting.key}`] ?? setting.key}
                  </p>
                </div>
                {setting.key === "notify_email_address" ? (
                  <input
                    type="email"
                    disabled={!canEdit}
                    value={values[setting.key] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                    }
                    placeholder={labels.emailPlaceholder}
                    className="w-full sm:w-72 rounded-md border bg-background px-3 py-2 text-sm"
                  />
                ) : (
                  <select
                    disabled={!canEdit}
                    value={values[setting.key] ?? setting.value}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [setting.key]: e.target.value }))
                    }
                    className="w-full sm:w-32 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="true">{labels.enabled}</option>
                    <option value="false">{labels.disabled}</option>
                  </select>
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <Button onClick={save} disabled={saving || loading}>
              {saving ? labels.saving : labels.save}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">{labels.disclaimer}</p>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
