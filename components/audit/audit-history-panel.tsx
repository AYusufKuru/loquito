"use client";

import { apiFetch } from "@/lib/http";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SerializedAuditLog } from "@/lib/audit/serialize";

interface AuditHistoryPanelProps {
  entityType: string;
  entityId: string;
  labels: Record<string, string>;
  compact?: boolean;
}

export function AuditHistoryPanel({
  entityType,
  entityId,
  labels,
  compact = false,
}: AuditHistoryPanelProps) {
  const [logs, setLogs] = useState<SerializedAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        entityType,
        entityId,
        limit: "100",
      });
      const res = await apiFetch(`/api/audit?${params}`);
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
  }, [entityId, entityType, labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const content = (
    <div className="space-y-2">
      {loading && <p className="text-sm text-muted-foreground">{labels.loading}</p>}
      {!loading && logs.length === 0 && (
        <p className="text-sm text-muted-foreground">{labels.noLogs}</p>
      )}
      {logs.map((log) => (
        <div key={log.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{log.actionLabel}</Badge>
            <span className="font-medium">{log.fieldLabel}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(log.createdAt).toLocaleString("tr-TR")}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {log.userName ?? labels.systemUser}:{" "}
            <span className="text-foreground">
              {log.oldValue ?? "—"} → {log.newValue ?? "—"}
            </span>
          </p>
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  if (compact) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.historyTitle}</CardTitle>
        <CardDescription>{labels.historyDesc}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
