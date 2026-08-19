"use client";

import { apiFetch } from "@/lib/http";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OrderProductionAnalysis } from "@/lib/orders/production-analysis";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface OrderProductionAnalysisPanelProps {
  orderId: string;
  canStart: boolean;
  onStartJob?: () => void;
  labels: Record<string, string>;
}

export function OrderProductionAnalysisPanel({
  orderId,
  canStart,
  onStartJob,
  labels,
}: OrderProductionAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<OrderProductionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/orders/sales/${orderId}/analysis`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setAnalysis(data.analysis);
      })
      .catch(() => {
        if (active) setError(labels.connectionError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, labels.connectionError]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{labels.loadingAnalysis}</p>;
  }

  if (error || !analysis) {
    return <p className="text-sm text-destructive">{error || labels.analysisError}</p>;
  }

  return (
    <div className="space-y-4">
      {analysis.hasShortage && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50/50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          {labels.shortageWarning}
        </div>
      )}

      {analysis.monthlyOverheadCents > 0 && (
        <p className="text-xs text-muted-foreground">
          {labels.overheadNote
            .replace("{month}", analysis.overheadPeriodMonth)
            .replace(
              "{method}",
              analysis.overheadAllocationMethod === "kg"
                ? labels.overheadMethodKg
                : labels.overheadMethodHours,
            )}
          {" — "}
          {formatBrlFromCents(analysis.monthlyOverheadCents)} / ay
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{labels.lineAnalysis}</CardTitle>
          <CardDescription>{labels.lineAnalysisDesc}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2">{labels.product}</th>
                <th className="px-3 py-2">{labels.required}</th>
                <th className="px-3 py-2">{labels.fromStock}</th>
                <th className="px-3 py-2">{labels.toProduce}</th>
                <th className="px-3 py-2">{labels.batches}</th>
                <th className="px-3 py-2">{labels.revenue}</th>
                <th className="px-3 py-2">{labels.materialCost}</th>
                <th className="px-3 py-2">
                  {analysis.laborIsEstimated ? labels.laborEstimated : labels.laborCost}
                </th>
                <th className="px-3 py-2">{labels.overheadCost}</th>
                <th className="px-3 py-2">{labels.prodCost}</th>
                <th className="px-3 py-2">{labels.expectedProfit}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.productId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{line.productSku}</span>
                    <span className="ml-1 text-muted-foreground">{line.productName}</span>
                  </td>
                  <td className="px-3 py-2">
                    {line.requiredUnits} {labels.unitPieceShort}
                    <span className="text-xs text-muted-foreground">
                      ({line.requiredBoxes} {labels.unitBoxShort})
                    </span>
                  </td>
                  <td className="px-3 py-2">{line.fromStockUnits}</td>
                  <td className="px-3 py-2">
                    {line.toProduceUnits} / {line.toProduceBoxes} {labels.unitBoxShort}
                  </td>
                  <td className="px-3 py-2">{line.batchesNeeded}</td>
                  <td className="px-3 py-2">{formatBrlFromCents(line.revenueCents)}</td>
                  <td className="px-3 py-2">
                    {formatBrlFromCents(line.materialCostCents)}
                  </td>
                  <td className="px-3 py-2">
                    {formatBrlFromCents(line.laborCostCents)}
                  </td>
                  <td className="px-3 py-2">
                    {formatBrlFromCents(line.overheadCostCents)}
                  </td>
                  <td className="px-3 py-2">
                    {formatBrlFromCents(line.productionCostCents)}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {formatBrlFromCents(line.expectedProfitCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{labels.materialNeeds}</CardTitle>
          <CardDescription>{labels.materialNeedsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {analysis.materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noProductionNeeded}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.material}</th>
                  <th className="px-3 py-2">{labels.requiredQty}</th>
                  <th className="px-3 py-2">{labels.availableQty}</th>
                  <th className="px-3 py-2">{labels.shortage}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.materials.map((m) => (
                  <tr key={m.materialId} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{m.materialCode}</span>
                      <span className="ml-1">{m.materialName}</span>
                    </td>
                    <td className="px-3 py-2">
                      {m.requiredQty} {m.unit}
                    </td>
                    <td className="px-3 py-2">
                      {m.availableQty} {m.unit}
                    </td>
                    <td className="px-3 py-2">
                      {m.shortageQty > 0 ? (
                        <Badge
                          variant={m.isShort ? "destructive" : "outline"}
                          className={
                            m.isShort
                              ? undefined
                              : "border-amber-500/60 text-amber-800 dark:text-amber-200"
                          }
                        >
                          −{m.shortageQty} {m.unit}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{labels.ok}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="space-y-1 text-sm">
            <div>
              {labels.totalRevenue}:{" "}
              <span className="font-medium">
                {formatBrlFromCents(analysis.totalRevenueCents)}
              </span>
            </div>
            <div>
              {labels.totalMaterialCost}:{" "}
              <span className="font-medium">
                {formatBrlFromCents(analysis.totalMaterialCostCents)}
              </span>
            </div>
            <div>
              {analysis.laborIsEstimated ? labels.laborEstimated : labels.totalLaborCost}:{" "}
              <span className="font-medium">
                {formatBrlFromCents(analysis.totalLaborCostCents)}
              </span>
            </div>
            <div>
              {labels.totalOverheadCost}:{" "}
              <span className="font-medium">
                {formatBrlFromCents(analysis.totalOverheadCostCents)}
              </span>
            </div>
            <div>
              {labels.totalProdCost}:{" "}
              <span className="font-medium">
                {formatBrlFromCents(analysis.totalProductionCostCents)}
              </span>
            </div>
            <div className="text-base font-semibold">
              {labels.totalExpectedProfit}:{" "}
              {formatBrlFromCents(analysis.totalExpectedProfitCents)}
            </div>
          </div>
          {onStartJob && (
            <Button
              onClick={onStartJob}
              disabled={!canStart || analysis.hasShortage}
            >
              {labels.startJob}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
