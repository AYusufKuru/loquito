"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBrlFromCents } from "@/lib/stock/constants";
import type { StockSummary } from "@/lib/stock/types";

interface AlertsSummaryProps {
  summary: StockSummary;
  labels: Record<string, string>;
}

export function AlertsSummary({ summary, labels }: AlertsSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.totalValue}</CardDescription>
            <CardTitle className="text-2xl">
              {formatBrlFromCents(summary.totalValueCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.materialCount} {labels.materials}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.availableValue}</CardDescription>
            <CardTitle className="text-2xl">
              {formatBrlFromCents(summary.availableValueCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {labels.availableHint}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.quarantineLots}</CardDescription>
            <CardTitle className="text-2xl">{summary.quarantineLotCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {labels.quarantineHint}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.alerts}</CardDescription>
            <CardTitle className="text-2xl">{summary.alertCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {labels.alertsHint}
          </CardContent>
        </Card>
      </div>

      {summary.alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{labels.alertList}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <Badge
                  variant={alert.severity === "warning" ? "destructive" : "secondary"}
                  className="shrink-0 text-[10px]"
                >
                  {alert.type === "low_stock"
                    ? labels.lowStock
                    : alert.type === "quarantine"
                      ? labels.quarantine
                      : labels.expiring}
                </Badge>
                <span>{alert.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
