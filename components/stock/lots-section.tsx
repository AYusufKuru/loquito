"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LOT_STATUS_LABELS,
  LOT_STATUSES,
  type LotStatus,
} from "@/lib/stock/lot-constants";
import { useFormErrors } from "@/hooks/use-form-errors";
import type { LotRow, StockCapabilities } from "@/lib/stock/types";

interface LotsSectionProps {
  initialLots: LotRow[];
  capabilities: StockCapabilities;
  labels: Record<string, string>;
}

export function LotsSection({
  initialLots,
  capabilities,
  labels,
}: LotsSectionProps) {
  const [lots, setLots] = useState(initialLots);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const { clearErrors, showApiError, showError, ErrorModal } = useFormErrors();

  const filtered =
    statusFilter === "all" ? lots : lots.filter((l) => l.status === statusFilter);

  async function updateLotStatus(lotId: string, status: LotStatus) {
    setLoading(lotId);
    clearErrors();
    setMessage("");
    try {
      const res = await fetch(`/api/stock/lots/${lotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setLots((prev) => prev.map((l) => (l.id === lotId ? data.lot : l)));
      setMessage(labels.lotUpdated);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading("");
    }
  }

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{labels.lotsTitle}</CardTitle>
            <CardDescription>{filtered.length} {labels.records}</CardDescription>
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{labels.allStatuses}</option>
            {LOT_STATUSES.map((s) => (
              <option key={s} value={s}>{LOT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">{labels.lotNo}</th>
                <th className="px-3 py-2 font-medium">{labels.colName}</th>
                <th className="px-3 py-2 font-medium">{labels.colStock}</th>
                <th className="px-3 py-2 font-medium">{labels.skt}</th>
                <th className="px-3 py-2 font-medium">{labels.lotStatus}</th>
                <th className="px-3 py-2 font-medium">{labels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lot) => (
                <tr key={lot.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{lot.internalLotNo}</td>
                  <td className="px-3 py-2">
                    <div>{lot.materialName}</div>
                    <div className="text-xs text-muted-foreground">{lot.materialCode}</div>
                  </td>
                  <td className="px-3 py-2">
                    {lot.quantity} {lot.materialUnit}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {lot.expiryDate
                      ? new Date(lot.expiryDate).toLocaleDateString("tr-TR")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        lot.status === "released"
                          ? "default"
                          : lot.status === "quarantine"
                            ? "secondary"
                            : lot.status === "destroyed"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {LOT_STATUS_LABELS[lot.status as LotStatus] ?? lot.status}
                    </Badge>
                    {lot.isUsable && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({labels.usable})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {capabilities.canEdit && lot.status === "quarantine" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading === lot.id}
                        onClick={() => updateLotStatus(lot.id, "released")}
                      >
                        {labels.releaseLot}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    {labels.noLots}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
    </>
  );
}
