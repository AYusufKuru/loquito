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
import { apiFetch } from "@/lib/http";
import type { PendingApprovalRow } from "@/lib/approvals/types";

interface PendingApprovalsSectionProps {
  labels: Record<string, string>;
  canApprove: boolean;
}

function formatRequestedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function PendingApprovalsSection({
  labels,
  canApprove,
}: PendingApprovalsSectionProps) {
  const [items, setItems] = useState<PendingApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState("");
  const [message, setMessage] = useState("");
  const { showError, showApiError, ErrorModal } = useFormErrors();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/settings/pending-approvals");
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setItems(data.pending ?? []);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError, showApiError, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    if (!canApprove) return;
    setApprovingId(id);
    setMessage("");
    try {
      const res = await apiFetch(`/api/settings/pending-approvals/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, labels.approveError);
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== id));
      setMessage(labels.approved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setApprovingId("");
    }
  };

  return (
    <>
      {ErrorModal}
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {labels.refresh}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {item.typeLabel} · {item.entityLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[item.orderNo, item.customerName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {canApprove ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void approve(item.id)}
                      disabled={Boolean(approvingId)}
                    >
                      {labels.approve}
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">{labels.requestedBy}: </span>
                  {item.requestedByName}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">{labels.requestedAt}: </span>
                  {formatRequestedAt(item.requestedAt)}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">{labels.reason}: </span>
                  {item.reason}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
