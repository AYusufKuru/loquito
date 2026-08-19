"use client";

import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import { validateReserveOrder } from "@/lib/forms/stock-validation";
import type {
  FinishedStockMatrixCell,
  FinishedStockReservationRow,
  FinishedStockRow,
  FinishedStockSummary,
} from "@/lib/finished-stock/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface OrderOption {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
}

interface FinishedGoodsSectionProps {
  initialRows: FinishedStockRow[];
  initialMatrix: FinishedStockMatrixCell[];
  initialSummary: FinishedStockSummary;
  initialReservations: FinishedStockReservationRow[];
  reserveOrders: OrderOption[];
  canEdit: boolean;
  labels: Record<string, string>;
}

export function FinishedGoodsSection({
  initialRows,
  initialMatrix,
  initialSummary,
  initialReservations,
  reserveOrders,
  canEdit,
  labels,
}: FinishedGoodsSectionProps) {
  const [rows, setRows] = useLiveState(initialRows);
  const [matrix, setMatrix] = useLiveState(initialMatrix);
  const [summary, setSummary] = useLiveState(initialSummary);
  const [reservations, setReservations] = useLiveState(initialReservations);
  const [selectedOrderId, setSelectedOrderId] = useState(reserveOrders[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const packagingColumns = useMemo(() => {
    const map = new Map<string, { id: string; label: string; netWeightG: number }>();
    for (const cell of matrix) {
      if (!map.has(cell.packagingId)) {
        map.set(cell.packagingId, {
          id: cell.packagingId,
          label: cell.packagingLabel,
          netWeightG: cell.netWeightG,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.netWeightG - b.netWeightG);
  }, [matrix]);

  const flavorRows = useMemo(() => {
    const seen = new Set<string>();
    const result: FinishedStockMatrixCell[] = [];
    for (const cell of matrix) {
      if (!seen.has(cell.flavorId)) {
        seen.add(cell.flavorId);
        result.push(cell);
      }
    }
    return result;
  }, [matrix]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, matrixRes, resRes] = await Promise.all([
        apiFetch("/api/stock/finished"),
        apiFetch("/api/stock/finished?view=matrix"),
        apiFetch("/api/stock/finished?view=reservations"),
      ]);
      const stockData = await stockRes.json();
      const matrixData = await matrixRes.json();
      const resData = await resRes.json();
      if (stockRes.ok) {
        setRows(stockData.rows);
        setSummary(stockData.summary);
      }
      if (matrixRes.ok) setMatrix(matrixData.matrix);
      if (resRes.ok) setReservations(resData.reservations);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError]);

  async function handleReserve(action: "reserve" | "release") {
    if (!applyValidationErrors(validateReserveOrder(selectedOrderId))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/stock/finished/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrderId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || labels.reserveError);
      setMessage(
        action === "reserve"
          ? labels.reservedOk.replace("{count}", String(data.count ?? 0))
          : labels.releasedOk.replace("{count}", String(data.released ?? 0)),
      );
      await refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : labels.reserveError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={labels.totalUnits} value={String(summary.totalUnits)} />
        <SummaryCard label={labels.availableUnits} value={String(summary.availableUnits)} />
        <SummaryCard label={labels.reservedUnits} value={String(summary.reservedUnits)} />
        <SummaryCard
          label={labels.finishedValue}
          value={formatBrlFromCents(summary.totalValueCents)}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{labels.matrixTitle}</CardTitle>
          <CardDescription>{labels.matrixDesc}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2">{labels.flavor}</th>
                {packagingColumns.map((p) => (
                  <th key={p.id} className="px-3 py-2">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flavorRows.map((flavorCell) => (
                <tr key={flavorCell.flavorId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{flavorCell.flavorName}</td>
                  {packagingColumns.map((p) => {
                    const cell = matrix.find(
                      (c) =>
                        c.flavorId === flavorCell.flavorId && c.packagingId === p.id,
                    );
                    if (!cell) {
                      return <td key={p.id} className="px-3 py-2 text-muted-foreground">—</td>;
                    }
                    return (
                      <td key={p.id} className="px-3 py-2">
                        <span className="font-medium">{cell.availableQty}</span>
                        {cell.reservedQty > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({cell.reservedQty} {labels.reservedShort})
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canEdit && reserveOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{labels.reserveTitle}</CardTitle>
            <CardDescription>{labels.reserveDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <FormField label={labels.selectOrder} error={fieldError("orderId")} required>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  clearFieldError("orderId");
                }}
              >
                {reserveOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo} — {o.customerName}
                  </option>
                ))}
              </select>
            </FormField>
            <Button size="sm" onClick={() => handleReserve("reserve")} disabled={loading}>
              {labels.reserveForOrder}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReserve("release")}
              disabled={loading}
            >
              {labels.releaseReservation}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{labels.lotDetailTitle}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2">{labels.flavor}</th>
                <th className="px-3 py-2">{labels.gramaj}</th>
                <th className="px-3 py-2">{labels.lotNo}</th>
                <th className="px-3 py-2">{labels.skt}</th>
                <th className="px-3 py-2">{labels.quantity}</th>
                <th className="px-3 py-2">{labels.reservedShort}</th>
                <th className="px-3 py-2">{labels.availableShort}</th>
                <th className="px-3 py-2">{labels.value}</th>
                <th className="px-3 py-2">{labels.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.flavorName}</td>
                  <td className="px-3 py-2">{row.packagingLabel}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.lotNo ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.expiryDate ? row.expiryDate.slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2">{row.quantity}</td>
                  <td className="px-3 py-2">{row.reservedQty}</td>
                  <td className="px-3 py-2 font-medium">{row.availableQty}</td>
                  <td className="px-3 py-2">{formatBrlFromCents(row.valueCents)}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{labels.reservationsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noReservations}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.orderNo}</th>
                  <th className="px-3 py-2">{labels.product}</th>
                  <th className="px-3 py-2">{labels.quantity}</th>
                  <th className="px-3 py-2">{labels.lotNo}</th>
                  <th className="px-3 py-2">{labels.status}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.orderNo}</td>
                    <td className="px-3 py-2">
                      {r.flavorName} · {r.packagingLabel}
                    </td>
                    <td className="px-3 py-2">{r.quantity}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.lotNo ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
