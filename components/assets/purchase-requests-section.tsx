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
import {
  PRIORITIES,
  REQUEST_TYPES,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  type PurchaseStatus,
} from "@/lib/assets/constants";
import type { PurchaseRequestRow, PurchaseSummary } from "@/lib/assets/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface PurchaseRequestsSectionProps {
  initialRequests: PurchaseRequestRow[];
  initialSummary: PurchaseSummary;
  suppliers: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canEdit: boolean;
  labels: Record<string, string>;
}

function emptyForm() {
  return {
    requestType: REQUEST_TYPES[0].value as string,
    itemName: "",
    description: "",
    usageArea: "",
    quantity: "1",
    unit: "",
    priority: PRIORITIES[2].value as string,
    supplierId: "",
    total: "",
    deliveryDays: "",
    warranty: "",
    notes: "",
  };
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_approval: "destructive",
  approved: "default",
  ordered: "secondary",
  delivered: "outline",
};

export function PurchaseRequestsSection({
  initialRequests,
  initialSummary,
  suppliers,
  canCreate,
  canEdit,
  labels,
}: PurchaseRequestsSectionProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [summary, setSummary] = useState(initialSummary);
  const [statusFilter, setStatusFilter] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [orderNoInput, setOrderNoInput] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/assets/purchase-requests${q}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.loadError);
        return;
      }
      setRequests(data.requests);
      setSummary(data.summary);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  function statusLabel(status: string) {
    const key = `status_${status}`;
    return labels[key] ?? STATUS_LABELS[status as PurchaseStatus] ?? status;
  }

  function nextActionLabel(status: string) {
    const next = STATUS_TRANSITIONS[status as PurchaseStatus];
    if (!next) return null;
    const key = `action_${next}`;
    return labels[key] ?? STATUS_LABELS[next];
  }

  async function createRequest() {
    if (!canCreate) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/assets/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: form.requestType,
          itemName: form.itemName,
          description: form.description || null,
          usageArea: form.usageArea || null,
          quantity: Number(form.quantity) || 1,
          unit: form.unit || null,
          priority: form.priority,
          supplierId: form.supplierId || null,
          total: form.total,
          deliveryDays: form.deliveryDays
            ? Number(form.deliveryDays)
            : null,
          warranty: form.warranty || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.saveError);
        return;
      }
      setMessage(labels.created);
      setForm(emptyForm());
      setIsCreating(false);
      await load();
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function advanceStatus(req: PurchaseRequestRow) {
    if (!canEdit) return;
    const next = STATUS_TRANSITIONS[req.status as PurchaseStatus];
    if (!next) return;

    const orderNo =
      next === "ordered" ? orderNoInput[req.id]?.trim() : undefined;
    if (next === "ordered" && !orderNo) {
      setError(labels.orderNoRequired);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/assets/purchase-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceStatus: true,
          orderNo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.saveError);
        return;
      }
      setMessage(labels.statusUpdated);
      await load();
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardDescription>{labels.pendingApproval}</CardDescription>
            <CardTitle className="text-2xl">
              {formatBrlFromCents(summary.pendingApprovalTotalCents)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {summary.pendingApprovalCount} {labels.requestCount}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.approvedTotal}</CardDescription>
            <CardTitle className="text-2xl">
              {formatBrlFromCents(summary.approvedTotalCents)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.orderedTotal}</CardDescription>
            <CardTitle className="text-2xl">
              {formatBrlFromCents(summary.orderedTotalCents)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.chocolateLineHint}</CardDescription>
            <CardTitle className="text-lg font-semibold">
              R$ 1.032.700,00
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {message && (
        <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{labels.allStatuses}</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {labels[`status_${value}`] ?? label}
            </option>
          ))}
        </select>
        {canCreate && (
          <Button
            type="button"
            variant={isCreating ? "secondary" : "default"}
            onClick={() => setIsCreating((v) => !v)}
          >
            {isCreating ? labels.cancel : labels.newRequest}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={load} disabled={loading}>
          {labels.refresh}
        </Button>
      </div>

      {isCreating && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>{labels.newRequest}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{labels.requestType}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.requestType}
                onChange={(e) =>
                  setForm({ ...form, requestType: e.target.value })
                }
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{labels.itemName}</Label>
              <Input
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.usageArea}</Label>
              <Input
                value={form.usageArea}
                onChange={(e) => setForm({ ...form, usageArea: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.priority}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{labels.quantity}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.total}</Label>
              <Input
                placeholder="0,00"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.supplier}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.supplierId}
                onChange={(e) =>
                  setForm({ ...form, supplierId: e.target.value })
                }
              >
                <option value="">{labels.noSupplier}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{labels.deliveryDays}</Label>
              <Input
                type="number"
                value={form.deliveryDays}
                onChange={(e) =>
                  setForm({ ...form, deliveryDays: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>{labels.description}</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" onClick={createRequest} disabled={loading}>
                {loading ? labels.saving : labels.create}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{labels.requestsTitle}</CardTitle>
          <CardDescription>{labels.requestsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noRequests}</p>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const nextLabel = nextActionLabel(req.status);
                const needsOrderNo =
                  STATUS_TRANSITIONS[req.status as PurchaseStatus] ===
                  "ordered";

                return (
                  <div
                    key={req.id}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{req.itemName}</p>
                        <p className="text-sm text-muted-foreground">
                          {req.usageArea ?? labels.noUsageArea}
                          {req.supplierName ? ` · ${req.supplierName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.priority && (
                          <Badge variant="outline">{req.priority}</Badge>
                        )}
                        <Badge variant={STATUS_VARIANT[req.status] ?? "outline"}>
                          {statusLabel(req.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span>
                        {labels.total}:{" "}
                        <strong>{formatBrlFromCents(req.totalCents)}</strong>
                      </span>
                      <span>
                        {labels.quantity}: {req.quantity}
                        {req.unit ? ` ${req.unit}` : ""}
                      </span>
                      {req.deliveryDays != null && (
                        <span>
                          {labels.deliveryDays}: {req.deliveryDays} gün
                        </span>
                      )}
                      {req.orderNo && (
                        <span>
                          {labels.orderNo}: {req.orderNo}
                        </span>
                      )}
                    </div>
                    {req.description && (
                      <p className="text-sm text-muted-foreground">
                        {req.description}
                      </p>
                    )}
                    {canEdit && nextLabel && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {needsOrderNo && (
                          <Input
                            className="max-w-xs"
                            placeholder={labels.orderNoPlaceholder}
                            value={orderNoInput[req.id] ?? ""}
                            onChange={(e) =>
                              setOrderNoInput((prev) => ({
                                ...prev,
                                [req.id]: e.target.value,
                              }))
                            }
                          />
                        )}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => advanceStatus(req)}
                          disabled={loading}
                        >
                          {nextLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
