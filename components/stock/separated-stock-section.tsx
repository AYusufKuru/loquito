"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { validateSeparateStock } from "@/lib/forms/stock-validation";
import { sanitizeIntInput } from "@/lib/forms/validation";
import { apiFetch } from "@/lib/http";
import type { FinishedStockRow } from "@/lib/finished-stock/types";
import type { SeparatedStockRow } from "@/lib/separated-stock/types";

interface SeparatedStockSectionProps {
  initialRows: SeparatedStockRow[];
  sourceLots: FinishedStockRow[];
  canEdit: boolean;
  labels: Record<string, string>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SeparatedStockSection({
  initialRows,
  sourceLots,
  canEdit,
  labels,
}: SeparatedStockSectionProps) {
  const [rows, setRows] = useLiveState(initialRows);
  const [lots, setLots] = useLiveState(sourceLots);
  const [stockId, setStockId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
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

  const availableLots = useMemo(
    () => lots.filter((row) => row.status === "available" && row.availableQty > 0),
    [lots],
  );
  const selected = availableLots.find((row) => row.id === stockId) ?? null;

  const refresh = useCallback(async () => {
    const [sepRes, finRes] = await Promise.all([
      apiFetch("/api/stock/separated"),
      apiFetch("/api/stock/finished"),
    ]);
    const sepData = await sepRes.json();
    const finData = await finRes.json();
    if (sepRes.ok) setRows(sepData.rows);
    if (finRes.ok) setLots(finData.rows);
  }, [setLots, setRows]);

  async function handleSeparate() {
    if (
      !applyValidationErrors(
        validateSeparateStock({
          stockId,
          quantity,
          notes,
          availableQty: selected?.availableQty,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/stock/separated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId,
          quantity: Number(quantity),
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.separateError);
        return;
      }
      setMessage(labels.separatedOk);
      setQuantity("");
      setNotes("");
      await refresh();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="space-y-6">
        {canEdit && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.separatedTitle}</CardTitle>
              <CardDescription>{labels.separatedDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField label={labels.selectFinishedLot} error={fieldError("stockId")} required>
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={stockId}
                  onChange={(e) => {
                    setStockId(e.target.value);
                    clearFieldError("stockId");
                  }}
                >
                  <option value="">{labels.selectFinishedLot}</option>
                  {availableLots.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.productSku ?? `${row.flavorName} ${row.packagingLabel}`}
                      {row.lotNo ? ` · ${row.lotNo}` : ""} — {row.availableQty} {labels.availableShort}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={labels.separateQty} error={fieldError("quantity")} required>
                  <Input
                    className="mt-1"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(sanitizeIntInput(e.target.value));
                      clearFieldError("quantity");
                    }}
                    placeholder={selected ? String(selected.availableQty) : ""}
                  />
                </FormField>
                <div>
                  <Label>{labels.availableShort}</Label>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selected ? selected.availableQty : "—"}
                  </p>
                </div>
              </div>

              <FormField label={labels.separateNotes} error={fieldError("notes")} required>
                <Input
                  className="mt-1"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    clearFieldError("notes");
                  }}
                  placeholder={labels.separateNotesPlaceholder}
                />
              </FormField>

              <Button onClick={() => void handleSeparate()} disabled={loading || !stockId}>
                {loading ? labels.separating : labels.separateAction}
              </Button>
              {message && <p className="text-sm text-green-600">{message}</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{labels.separatedListTitle}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.separatedEmpty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">{labels.product}</th>
                    <th className="px-3 py-2">{labels.lotNo}</th>
                    <th className="px-3 py-2">{labels.quantity}</th>
                    <th className="px-3 py-2">{labels.separateNotes}</th>
                    <th className="px-3 py-2">{labels.separatedDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        {row.productSku ?? `${row.flavorName} ${row.packagingLabel}`}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.lotNo ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{row.quantity}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.notes}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
