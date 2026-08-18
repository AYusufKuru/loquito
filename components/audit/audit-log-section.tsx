"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/constants";
import type { SerializedAuditLog } from "@/lib/audit/serialize";

interface AuditLogSectionProps {
  labels: Record<string, string>;
}

export function AuditLogSection({ labels }: AuditLogSectionProps) {
  const [logs, setLogs] = useState<SerializedAuditLog[]>([]);
  const [entityType, setEntityType] = useState("");
  const [field, setField] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (entityType) params.set("entityType", entityType);
      if (field.trim()) params.set("field", field.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.loadError);
        return;
      }
      setLogs(data.logs ?? []);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [entityType, field, from, to, labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.logTitle}</CardTitle>
        <CardDescription>{labels.logDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>{labels.filterEntityType}</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="">{labels.allTypes}</option>
              {AUDIT_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labels[`entity_${type}`] ?? type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{labels.filterField}</Label>
            <Input
              className="mt-1"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder={labels.filterFieldPlaceholder}
            />
          </div>
          <div>
            <Label>{labels.filterFrom}</Label>
            <Input type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{labels.filterTo}</Label>
            <Input type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? labels.loading : labels.refresh}
        </Button>

        <div className="space-y-2">
          {logs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">{labels.noLogs}</p>
          )}
          {logs.map((log) => (
            <div key={log.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{log.entityTypeLabel}</Badge>
                <Badge variant="outline">{log.actionLabel}</Badge>
                <span className="font-medium">{log.fieldLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("tr-TR")}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {log.userName ?? labels.systemUser} · {log.entityId.slice(0, 8)}…
              </p>
              <p className="mt-1">
                {log.oldValue ?? "—"} → {log.newValue ?? "—"}
              </p>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
