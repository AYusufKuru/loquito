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
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateFileRequired } from "@/lib/forms/finance-validation";
import type {
  BankStatementRow,
  StatementReceiptRow,
} from "@/lib/finance/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface StatementMatchingSectionProps {
  canCreate: boolean;
  canEdit: boolean;
  labels: Record<string, string>;
}

export function StatementMatchingSection({
  canCreate,
  canEdit,
  labels,
}: StatementMatchingSectionProps) {
  const [statements, setStatements] = useState<BankStatementRow[]>([]);
  const [receipts, setReceipts] = useState<StatementReceiptRow[]>([]);
  const [unmatched, setUnmatched] = useState<StatementReceiptRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    clearErrors();
    try {
      const [allRes, unmatchedRes] = await Promise.all([
        apiFetch("/api/finance/statements"),
        apiFetch("/api/finance/statements?unmatchedOnly=true"),
      ]);
      const allData = await allRes.json();
      const unmatchedData = await unmatchedRes.json();
      if (!allRes.ok) {
        showApiError(allData, labels.loadError);
        return;
      }
      setStatements(allData.statements ?? []);
      setReceipts(allData.receipts ?? []);
      setUnmatched(unmatchedData.receipts ?? []);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadStatement() {
    if (!canCreate) return;
    if (!applyValidationErrors(validateFileRequired(file, labels.file))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file!);
      const res = await apiFetch("/api/finance/statements", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.uploadError);
        return;
      }
      setMessage(labels.statementUploaded);
      setFile(null);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function loadDemo() {
    if (!canCreate) return;
    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/finance/statements/demo", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.uploadError);
        return;
      }
      setMessage(labels.demoLoaded);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approveSelected() {
    if (!canEdit || selected.size === 0) return;
    setLoading(true);
    clearErrors();
    setMessage("");
    let ok = 0;
    try {
      for (const id of selected) {
        const res = await apiFetch(`/api/finance/receipts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approve: true }),
        });
        if (res.ok) ok += 1;
      }
      setMessage(`${ok} ${labels.approvedCount}`);
      setSelected(new Set());
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function approveOne(id: string) {
    if (!canEdit) return;
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/finance/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.approveError);
        return;
      }
      setMessage(labels.approved);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  const pendingReceipts = receipts.filter((r) => !r.isApproved);

  return (
    <>
      {ErrorModal}
      <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.matchingTitle}</CardTitle>
          <CardDescription>{labels.matchingDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canCreate && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">{labels.uploadStatement}</p>
              <div className="flex flex-wrap gap-2 items-end">
                <FormField label={labels.file} error={fieldError("file")} required>
                  <Input
                    type="file"
                    className="mt-1"
                    accept=".txt,.pdf,.csv"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      clearFieldError("file");
                    }}
                  />
                </FormField>
                <Button onClick={uploadStatement} disabled={loading}>
                  {labels.uploadStatement}
                </Button>
                <Button
                  variant="outline"
                  onClick={loadDemo}
                  disabled={loading}
                >
                  {labels.loadDemo}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              {labels.refresh}
            </Button>
            {canEdit && selected.size > 0 && (
              <Button onClick={approveSelected} disabled={loading}>
                {labels.approveSelected} ({selected.size})
              </Button>
            )}
          </div>

          {message && (
            <p className="text-sm text-green-600 dark:text-green-400">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      {statements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.statementsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {statements.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap gap-4 justify-between border-b py-2 last:border-0"
                >
                  <span>{s.fileName}</span>
                  <span className="text-muted-foreground">
                    {s.lineCount} {labels.lines} · {s.matchedCount}{" "}
                    {labels.matched} · {s.approvedCount} {labels.approved}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.pendingTitle}</CardTitle>
          <CardDescription>{labels.pendingDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noPending}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    {canEdit && <th className="px-2 py-2 w-8" />}
                    <th className="px-3 py-2">{labels.date}</th>
                    <th className="px-3 py-2">{labels.direction}</th>
                    <th className="px-3 py-2">{labels.counterparty}</th>
                    <th className="px-3 py-2">{labels.amount}</th>
                    <th className="px-3 py-2">{labels.orderNo}</th>
                    <th className="px-3 py-2">{labels.match}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pendingReceipts.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      {canEdit && (
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            aria-label={labels.approve}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {r.transactionDate?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">
                          {r.direction === "out"
                            ? labels.directionOut
                            : labels.directionIn}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{r.counterparty ?? "—"}</td>
                      <td className="px-3 py-2">
                        {r.amountCents != null
                          ? formatBrlFromCents(r.amountCents)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.orderNo ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.isMatched ? (
                          <Badge variant="secondary">{labels.matched}</Badge>
                        ) : (
                          <Badge variant="outline">{labels.unmatched}</Badge>
                        )}
                        {r.matchReason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {r.matchReason}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => approveOne(r.id)}
                            disabled={loading}
                          >
                            {labels.approve}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {unmatched.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">{labels.reviewTitle}</CardTitle>
            <CardDescription>{labels.reviewDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {unmatched.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>
                    {r.counterparty ?? r.fileName} —{" "}
                    {r.amountCents != null
                      ? formatBrlFromCents(r.amountCents)
                      : "—"}
                  </span>
                  <Badge variant="outline">{labels.reviewBadge}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
