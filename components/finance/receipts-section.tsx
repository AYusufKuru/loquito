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
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateFileRequired } from "@/lib/forms/finance-validation";
import type { ReceiptRow } from "@/lib/finance/receipts";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface ReceiptsSectionProps {
  canCreate: boolean;
  labels: Record<string, string>;
}

export function ReceiptsSection({ canCreate, labels }: ReceiptsSectionProps) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
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
  const [file, setFile] = useState<File | null>(null);
  const [counterparty, setCounterparty] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/finance/receipts");
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setReceipts(data.receipts);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload() {
    if (!canCreate) return;
    if (!applyValidationErrors(validateFileRequired(file, labels.file))) return;

    setLoading(true);
    clearErrors();
    try {
      const form = new FormData();
      form.append("file", file!);
      if (counterparty) form.append("counterparty", counterparty);
      const res = await fetch("/api/finance/receipts", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.uploadError);
        return;
      }
      setMessage(labels.uploaded);
      setFile(null);
      setCounterparty("");
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.receiptsTitle}</CardTitle>
        <CardDescription>{labels.receiptsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canCreate && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{labels.uploadReceipt}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={labels.file} error={fieldError("file")} required>
                <Input
                  type="file"
                  className="mt-1"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    clearFieldError("file");
                  }}
                />
              </FormField>
              <div>
                <Label>{labels.counterparty}</Label>
                <Input
                  className="mt-1"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={upload} disabled={loading}>
              {labels.uploadReceipt}
            </Button>
          </div>
        )}

        <Button variant="outline" onClick={load} disabled={loading}>
          {labels.refresh}
        </Button>

        {message && <p className="text-sm text-green-600">{message}</p>}

        {receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.noReceipts}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.file}</th>
                  <th className="px-3 py-2">{labels.counterparty}</th>
                  <th className="px-3 py-2">{labels.amount}</th>
                  <th className="px-3 py-2">{labels.date}</th>
                  <th className="px-3 py-2">{labels.matched}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{r.fileName}</td>
                    <td className="px-3 py-2">{r.counterparty ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.amountCents != null
                        ? formatBrlFromCents(r.amountCents)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.transactionDate?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.isMatched ? (
                        <Badge variant="secondary">{labels.matched}</Badge>
                      ) : (
                        <Badge variant="outline">{labels.unmatched}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={`/api/finance/receipts/${r.id}/file`}
                        className="text-primary underline text-xs"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {labels.download}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
