"use client";

import { apiFetch } from "@/lib/http";

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
import type { GmailInboxRow, GmailStatus } from "@/lib/gmail/types";

interface GmailSectionProps {
  canCreate: boolean;
  canEdit: boolean;
  labels: Record<string, string>;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  processed: "secondary",
  failed: "destructive",
  skipped: "outline",
};

export function GmailSection({
  canCreate,
  canEdit,
  labels,
}: GmailSectionProps) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [messages, setMessages] = useState<GmailInboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRes, inboxRes] = await Promise.all([
        apiFetch("/api/ai/gmail/status"),
        apiFetch("/api/ai/gmail/inbox"),
      ]);
      const statusData = await statusRes.json();
      const inboxData = await inboxRes.json();
      if (!statusRes.ok) {
        setError(statusData.error || labels.loadError);
        return;
      }
      if (!inboxRes.ok) {
        setError(inboxData.error || labels.loadError);
        return;
      }
      setStatus(statusData.status);
      setMessages(inboxData.messages);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  async function connectGmail() {
    if (!canEdit) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/ai/gmail/auth");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.connectError);
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function syncInbox() {
    if (!canCreate) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/ai/gmail/inbox", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.syncError);
        return;
      }
      setMessages(data.messages);
      setMessage(
        `${labels.syncDone}: ${data.created} ${labels.ordersCreated}, ${data.failed} ${labels.failed}`,
      );
      const statusRes = await apiFetch("/api/ai/gmail/status");
      const statusData = await statusRes.json();
      if (statusRes.ok) setStatus(statusData.status);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function statusLabel(s: string) {
    const key = `status_${s}`;
    return labels[key] ?? s;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.connectionStatus}</CardDescription>
            <CardTitle className="text-lg">
              {status?.connected
                ? labels.connected
                : status?.demoMode
                  ? labels.demoMode
                  : labels.notConnected}
            </CardTitle>
            {status?.email && (
              <p className="text-xs text-muted-foreground">{status.email}</p>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.pendingCount}</CardDescription>
            <CardTitle className="text-2xl">
              {status?.pendingCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.processedCount}</CardDescription>
            <CardTitle className="text-2xl">
              {status?.processedCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {status?.demoMode && (
        <p className="text-sm text-muted-foreground">{labels.demoHint}</p>
      )}

      {message && (
        <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {canEdit && status?.configured && !status.connected && (
          <Button type="button" onClick={connectGmail} disabled={loading}>
            {labels.connectGmail}
          </Button>
        )}
        {canCreate && (
          <Button
            type="button"
            variant="default"
            onClick={syncInbox}
            disabled={loading}
          >
            {labels.syncInbox}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={load} disabled={loading}>
          {labels.refresh}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{labels.inboxTitle}</CardTitle>
          <CardDescription>{labels.inboxDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noMessages}</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{msg.subject ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {msg.fromEmail ?? labels.unknownSender}
                        {msg.attachmentName ? ` · ${msg.attachmentName}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {msg.isDemo && (
                        <Badge variant="outline">{labels.demoBadge}</Badge>
                      )}
                      <Badge variant={STATUS_VARIANT[msg.status] ?? "outline"}>
                        {statusLabel(msg.status)}
                      </Badge>
                    </div>
                  </div>
                  {msg.orderNo && (
                    <p className="text-sm">
                      {labels.linkedOrder}:{" "}
                      <a
                        href="/orders"
                        className="font-mono text-primary underline-offset-4 hover:underline"
                      >
                        {msg.orderNo}
                      </a>
                      <Badge variant="secondary" className="ml-2">
                        {labels.draftOrder}
                      </Badge>
                    </p>
                  )}
                  {msg.errorMessage && (
                    <p className="text-sm text-destructive">{msg.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
