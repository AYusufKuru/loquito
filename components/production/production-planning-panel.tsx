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
import { validatePlanScenario } from "@/lib/forms/production-validation";
import { sanitizeIntInput } from "@/lib/forms/validation";
import type { ProductionPlanResult } from "@/lib/production/types";

export interface PlanOrderOption {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
  deliveryDate: string | null;
}

interface ProductionPlanningPanelProps {
  orders: PlanOrderOption[];
  labels: Record<string, string>;
}

export function ProductionPlanningPanel({
  orders,
  labels,
}: ProductionPlanningPanelProps) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [startDate, setStartDate] = useState(() => toDateInput(new Date()));
  const [plan, setPlan] = useState<ProductionPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const [scenarioBoxes, setScenarioBoxes] = useState("10000");
  const [scenarioGrammage, setScenarioGrammage] = useState("250");

  const loadPlan = useCallback(
    async (orderId: string, date: string) => {
      if (!orderId) return;
      setLoading(true);
      clearErrors();
      try {
        const res = await fetch(
          `/api/production/plan?orderId=${encodeURIComponent(orderId)}&startDate=${date}`,
        );
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.planError);
          setPlan(null);
          return;
        }
        setPlan(data.plan);
      } catch {
        showError(labels.connectionError);
        setPlan(null);
      } finally {
        setLoading(false);
      }
    },
    [labels.connectionError, labels.planError],
  );

  useEffect(() => {
    if (selectedOrderId) {
      loadPlan(selectedOrderId, startDate);
    }
  }, [selectedOrderId, startDate, loadPlan]);

  async function runScenario() {
    if (!applyValidationErrors(validatePlanScenario({ boxes: scenarioBoxes, startDate }))) {
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/production/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxes: Number(scenarioBoxes),
          netWeightG: Number(scenarioGrammage),
          startDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.planError);
        return;
      }
      setPlan(data.plan);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.planParams}</CardTitle>
          <CardDescription>{labels.planParamsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{labels.selectOrder}</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              {orders.length === 0 && (
                <option value="">{labels.noOrders}</option>
              )}
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} — {o.customerName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{labels.planStartDate}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FormField label={labels.scenarioBoxes} error={fieldError("scenarioBoxes")} required>
              <Input
                value={scenarioBoxes}
                onChange={(e) => {
                  setScenarioBoxes(sanitizeIntInput(e.target.value));
                  clearFieldError("scenarioBoxes");
                }}
                placeholder="10000"
              />
            </FormField>
          </div>
          <div className="space-y-2">
            <Label>{labels.scenarioGrammage}</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={scenarioGrammage}
              onChange={(e) => setScenarioGrammage(e.target.value)}
            >
              <option value="250">250 g</option>
              <option value="85">85 g</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedOrderId && loadPlan(selectedOrderId, startDate)}
              disabled={loading || !selectedOrderId}
            >
              {labels.refreshPlan}
            </Button>
            <Button size="sm" onClick={runScenario} disabled={loading}>
              {labels.runScenario}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <p className="text-sm text-muted-foreground">{labels.loadingPlan}</p>
      )}

      {plan && !loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label={labels.estimatedCompletion} value={plan.estimatedCompletionDate} />
            <SummaryCard
              label={labels.totalWorkDays}
              value={String(plan.totalWorkDays)}
            />
            <SummaryCard
              label={labels.totalBatches}
              value={String(plan.totalBatches)}
            />
            <SummaryCard
              label={labels.totalBoxes}
              value={String(plan.totalBoxesToProduce)}
            />
          </div>

          {plan.deliveryDateRequested && (
            <div className="flex items-center gap-2 text-sm">
              <span>{labels.requestedDelivery}: {plan.deliveryDateRequested}</span>
              {plan.meetsDelivery != null && (
                <Badge variant={plan.meetsDelivery ? "secondary" : "destructive"}>
                  {plan.meetsDelivery ? labels.meetsDelivery : labels.missesDelivery}
                </Badge>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.timelineTitle}</CardTitle>
              <CardDescription>
                {labels.cookingDays}: {plan.cookingWorkDays} · {labels.cuttingDays}:{" "}
                {plan.cuttingWorkDays} · {labels.potCount}:{" "}
                {plan.settingsSnapshot.potCount}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">{labels.date}</th>
                    <th className="px-3 py-2">{labels.workDay}</th>
                    <th className="px-3 py-2">{labels.cookingBatches}</th>
                    <th className="px-3 py-2">{labels.cuttingBoxes}</th>
                    <th className="px-3 py-2">{labels.cumulativeCut}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.timeline.map((day) => (
                    <tr key={day.workDayIndex} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{day.date}</td>
                      <td className="px-3 py-2">{day.workDayIndex}</td>
                      <td className="px-3 py-2">
                        {day.cookingBatches > 0 ? day.cookingBatches : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {day.cuttingBoxes > 0 ? day.cuttingBoxes : "—"}
                      </td>
                      <td className="px-3 py-2">{day.cumulativeCutBoxes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {plan.lines.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{labels.lineCapacity}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-2">{labels.product}</th>
                      <th className="px-3 py-2">{labels.grammage}</th>
                      <th className="px-3 py-2">{labels.toProduce}</th>
                      <th className="px-3 py-2">{labels.batches}</th>
                      <th className="px-3 py-2">{labels.dailyCapacity}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map((line) => (
                      <tr key={`${line.productSku}-${line.netWeightG}`} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{line.productSku}</td>
                        <td className="px-3 py-2">{line.netWeightG} g</td>
                        <td className="px-3 py-2">{line.toProduceBoxes}</td>
                        <td className="px-3 py-2">{line.batchesNeeded}</td>
                        <td className="px-3 py-2">{line.dailyCapacity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
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

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
