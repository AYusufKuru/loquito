"use client";

import { useCallback, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { KanbanColumn } from "@/components/ui/kanban-column";
import { Input } from "@/components/ui/input";
import { WorkflowStrip } from "@/components/ui/workflow-strip";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import {
  validateProductionComplete,
  validateProductionStart,
} from "@/lib/forms/production-validation";
import { sanitizeDecimalInput, sanitizeIntInput } from "@/lib/forms/validation";
import {
  KANBAN_PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
} from "@/lib/production/order-constants";
import type { SerializedProductionOrder } from "@/lib/production/serialize";

interface LineOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface LotOption {
  id: string;
  materialId: string;
  internalLotNo: string;
  quantity: number;
}

interface ProductionOrdersSectionProps {
  initialOrders: SerializedProductionOrder[];
  lines: LineOption[];
  canEdit: boolean;
  labels: Record<string, string>;
}

const KANBAN_ACCENT: Record<string, string> = {
  planned: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
};

function orderStepStatus(
  detail: SerializedProductionOrder | null,
  step: "planned" | "in_progress" | "completed",
): "complete" | "current" | "upcoming" {
  if (!detail) return "upcoming";
  const order = ["planned", "in_progress", "completed"];
  const currentIdx = order.indexOf(
    detail.status === "cancelled" ? "planned" : detail.status,
  );
  const stepIdx = order.indexOf(step);
  if (stepIdx < currentIdx) return "complete";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

export function ProductionOrdersSection({
  initialOrders,
  lines,
  canEdit,
  labels,
}: ProductionOrdersSectionProps) {
  const [orders, setOrders] = useLiveState(initialOrders);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<SerializedProductionOrder | null>(null);
  const [lotsByMaterial, setLotsByMaterial] = useState<Record<string, LotOption[]>>({});
  const [availableQtyByMaterial, setAvailableQtyByMaterial] = useState<
    Record<string, number>
  >({});
  const [lotsLoading, setLotsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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

  const [producedUnits, setProducedUnits] = useState("");
  const [scrapKg, setScrapKg] = useState("0");
  const [consumptionInputs, setConsumptionInputs] = useState<
    Record<string, { actualQty: string; lotId: string }>
  >({});
  const [assignLineId, setAssignLineId] = useState("");
  const loadedLotMaterials = useRef(new Set<string>());

  const cookerLines = lines.filter((l) => l.type === "cooker");

  const applyDetail = useCallback(
    (order: SerializedProductionOrder) => {
      setDetail(order);
      setProducedUnits(String(order.producedUnits || ""));
      setScrapKg(String(order.scrapKg || "0"));
      setAssignLineId(order.lineId ?? cookerLines[0]?.id ?? "");

      const inputs: Record<string, { actualQty: string; lotId: string }> = {};
      for (const c of order.consumptions) {
        inputs[c.id] = {
          actualQty: String(c.actualQty > 0 ? c.actualQty : c.plannedQty),
          lotId: c.lotId ?? "",
        };
      }
      setConsumptionInputs(inputs);
    },
    [cookerLines],
  );

  const loadLotsForOrder = useCallback(
    async (order: SerializedProductionOrder) => {
      const materialIds = [...new Set(order.consumptions.map((c) => c.materialId))];
      const missingIds = materialIds.filter((id) => !loadedLotMaterials.current.has(id));
      if (missingIds.length === 0) return;

      setLotsLoading(true);
      try {
        const results = await Promise.all(
          missingIds.map(async (materialId) => {
            const lotRes = await apiFetch(
              `/api/stock/lots?materialId=${materialId}&status=released`,
            );
            const lotData = await lotRes.json();
            if (!lotRes.ok) {
              return { materialId, availableQty: undefined, lots: [] as LotOption[] };
            }
            return {
              materialId,
              availableQty: lotData.availableQty as number | undefined,
              lots: lotData.lots.map((l: LotOption) => ({
                id: l.id,
                materialId: l.materialId,
                internalLotNo: l.internalLotNo,
                quantity: l.quantity,
              })),
            };
          }),
        );

        for (const { materialId } of results) {
          loadedLotMaterials.current.add(materialId);
        }

        setLotsByMaterial((prev) => {
          const next = { ...prev };
          for (const { materialId, lots } of results) {
            next[materialId] = lots;
          }
          return next;
        });
        setAvailableQtyByMaterial((prev) => {
          const next = { ...prev };
          for (const { materialId, availableQty } of results) {
            if (availableQty != null) {
              next[materialId] = availableQty;
            }
          }
          return next;
        });
      } catch {
        showError(labels.connectionError);
      } finally {
        setLotsLoading(false);
      }
    },
    [labels.connectionError, showError],
  );

  const selectOrder = useCallback(
    (id: string) => {
      setSelectedId(id);
      clearErrors();
      setMessage("");

      const order = orders.find((o) => o.id === id);
      if (!order) return;

      applyDetail(order);
      loadedLotMaterials.current.clear();
      setLotsByMaterial({});
      setAvailableQtyByMaterial({});
      if (order.status === "in_progress") {
        void loadLotsForOrder(order);
      }
    },
    [applyDetail, loadLotsForOrder, orders],
  );

  async function handleStart() {
    if (!detail) return;
    if (!applyValidationErrors(validateProductionStart(assignLineId))) return;

    setActionLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/production/orders/${detail.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId: assignLineId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.startError);
        return;
      }
      syncOrder(data.order);
      setMessage(labels.started);
      void loadLotsForOrder(data.order as SerializedProductionOrder);
    } catch {
      showError(labels.connectionError);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    if (!detail) return;
    if (
      !applyValidationErrors(
        validateProductionComplete({
          producedUnits,
          scrapKg,
          consumptions: detail.consumptions.map((c) => ({
            id: c.id,
            materialCode: c.materialCode,
            actualQty: consumptionInputs[c.id]?.actualQty ?? "",
          })),
        }),
      )
    ) {
      return;
    }

    const rollbackOrders = orders;
    const rollbackDetail = detail;

    // Kart hemen "tamamlandı" kolonuna geçsin. producedKg ve yieldPercent
    // sunucuda hesaplandığı için burada uydurmuyoruz; yanıt gelince doluyor.
    syncOrder({
      ...detail,
      status: "completed",
      statusLabel: PRODUCTION_STATUS_LABELS.completed,
      producedUnits: Number(producedUnits),
      scrapKg: Number(scrapKg) || 0,
      yieldPercent: null,
    });

    setActionLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch(`/api/production/orders/${rollbackDetail.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producedUnits: Number(producedUnits),
          scrapKg: Number(scrapKg) || 0,
          consumptions: rollbackDetail.consumptions.map((c) => ({
            consumptionId: c.id,
            actualQty: Number(consumptionInputs[c.id]?.actualQty ?? c.plannedQty),
            lotId: consumptionInputs[c.id]?.lotId || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrders(rollbackOrders);
        setDetail(rollbackDetail);
        showApiError(data, labels.completeError);
        return;
      }
      syncOrder(data.order);
      setMessage(labels.completed);
    } catch {
      setOrders(rollbackOrders);
      setDetail(rollbackDetail);
      showError(labels.connectionError);
    } finally {
      setActionLoading(false);
    }
  }

  function syncOrder(order: SerializedProductionOrder) {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === order.id);
      if (exists) return prev.map((o) => (o.id === order.id ? order : o));
      return [order, ...prev];
    });
    setDetail(order);
  }

  return (
    <>
      {ErrorModal}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid w-full gap-3 sm:grid-cols-3">
            {KANBAN_PRODUCTION_STATUSES.map((status) => {
              const col = orders.filter((o) => o.status === status);
              return (
                <KanbanColumn
                  key={status}
                  title={PRODUCTION_STATUS_LABELS[status]}
                  count={col.length}
                  accentClass={KANBAN_ACCENT[status]}
                >
                  {col.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => selectOrder(order.id)}
                      className={`w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 ${
                        selectedId === order.id
                          ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-semibold">
                          {order.productionNo}
                        </p>
                        {order.status === "in_progress" && (
                          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {order.productSku ?? order.recipeCode}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{order.lotNo}</span>
                        {order.orderNo && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{order.orderNo}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </KanbanColumn>
              );
            })}
        </div>

        <Card>
          <CardHeader className="border-b bg-muted/20 py-3">
            <CardTitle className="text-base">{labels.orderDetail}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {!selectedId && (
              <EmptyState
                title={labels.selectOrder}
                className="border-0 bg-transparent py-8"
              />
            )}

            {detail && selectedId === detail.id && (
              <>
                <WorkflowStrip
                  compact
                  steps={[
                    {
                      id: "planned",
                      label: labels.stepPlanned,
                      status: orderStepStatus(detail, "planned"),
                    },
                    {
                      id: "in_progress",
                      label: labels.stepInProgress,
                      status: orderStepStatus(detail, "in_progress"),
                    },
                    {
                      id: "completed",
                      label: labels.stepCompleted,
                      status: orderStepStatus(detail, "completed"),
                    },
                  ]}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-semibold">
                    {detail.productionNo}
                  </span>
                  <Badge variant="secondary">{detail.statusLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{detail.lotNo}</span>
                </div>

                <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.product}</p>
                    <p className="font-medium">{detail.productSku ?? detail.recipeCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.salesOrder}</p>
                    <p className="font-medium">{detail.orderNo ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.plannedKg}</p>
                    <p className="font-medium">{detail.plannedKg} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.line}</p>
                    <p className="font-medium">{detail.lineName ?? labels.unassigned}</p>
                  </div>
                </div>

                {canEdit && detail.status === "planned" && (
                  <div className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <FormField
                          label={labels.assignCooker}
                          error={fieldError("lineId")}
                          required
                        >
                          <select
                            className="flex h-9 w-full min-w-[160px] rounded-md border border-input bg-background px-3 text-sm"
                            value={assignLineId}
                            onChange={(e) => {
                              setAssignLineId(e.target.value);
                              clearFieldError("lineId");
                            }}
                          >
                            {cookerLines.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      </div>
                      <Button size="sm" onClick={handleStart} disabled={actionLoading}>
                        {labels.startProduction}
                      </Button>
                    </div>
                  </div>
                )}

                {detail.status === "in_progress" && canEdit && (
                  <div className="space-y-3 rounded-xl border p-4">
                    <p className="text-sm font-medium">{labels.completeSection}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        label={labels.producedUnits}
                        error={fieldError("producedUnits")}
                        required
                      >
                        <Input
                          value={producedUnits}
                          onChange={(e) => {
                            setProducedUnits(sanitizeIntInput(e.target.value));
                            clearFieldError("producedUnits");
                          }}
                        />
                      </FormField>
                      <FormField label={labels.scrapKg} error={fieldError("scrapKg")}>
                        <Input
                          value={scrapKg}
                          onChange={(e) => {
                            setScrapKg(sanitizeDecimalInput(e.target.value));
                            clearFieldError("scrapKg");
                          }}
                        />
                      </FormField>
                    </div>

                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="px-3 py-2">{labels.material}</th>
                            <th className="px-3 py-2">{labels.plannedQty}</th>
                            <th className="px-3 py-2">{labels.availableQty}</th>
                            <th className="px-3 py-2">{labels.actualQty}</th>
                            <th className="px-3 py-2">{labels.lot}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.consumptions.map((c) => {
                            const availableQty = availableQtyByMaterial[c.materialId];
                            const actualQty = Number(
                              consumptionInputs[c.id]?.actualQty ?? c.plannedQty,
                            );
                            const insufficient =
                              availableQty != null &&
                              !Number.isNaN(actualQty) &&
                              actualQty > availableQty;

                            return (
                            <tr key={c.id} className="border-b last:border-0">
                              <td className="px-3 py-2">
                                <span className="font-mono text-xs">{c.materialCode}</span>
                                <span className="block text-muted-foreground">
                                  {c.materialName}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {c.plannedQty} {c.unit}
                              </td>
                              <td
                                className={`px-3 py-2 tabular-nums ${
                                  insufficient ? "font-medium text-destructive" : ""
                                }`}
                              >
                                {lotsLoading && availableQty == null
                                  ? "…"
                                  : availableQty != null
                                    ? `${availableQty} ${c.unit}`
                                    : "—"}
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  className="h-8 w-24"
                                  value={consumptionInputs[c.id]?.actualQty ?? ""}
                                  onChange={(e) => {
                                    const value = sanitizeDecimalInput(e.target.value);
                                    setConsumptionInputs((prev) => ({
                                      ...prev,
                                      [c.id]: {
                                        ...prev[c.id],
                                        actualQty: value,
                                      },
                                    }));
                                    clearFieldError(`consumption-${c.id}`);
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  className="h-8 min-w-[120px] rounded-md border px-2 text-xs"
                                  value={consumptionInputs[c.id]?.lotId ?? ""}
                                  disabled={lotsLoading}
                                  onChange={(e) =>
                                    setConsumptionInputs((prev) => ({
                                      ...prev,
                                      [c.id]: {
                                        ...prev[c.id],
                                        lotId: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">{labels.autoLot}</option>
                                  {(lotsByMaterial[c.materialId] ?? []).map((lot) => (
                                    <option key={lot.id} value={lot.id}>
                                      {lot.internalLotNo} ({lot.quantity})
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <Button onClick={handleComplete} disabled={actionLoading || lotsLoading}>
                      {actionLoading ? labels.saving : labels.closeBatch}
                    </Button>
                  </div>
                )}

                {detail.status === "completed" && (
                  <div className="grid gap-3 rounded-xl border bg-emerald-50/50 p-4 text-sm sm:grid-cols-2 dark:bg-emerald-950/20">
                    <div>
                      <p className="text-xs text-muted-foreground">{labels.producedUnits}</p>
                      <p className="font-semibold">{detail.producedUnits}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{labels.producedKg}</p>
                      <p className="font-semibold">{detail.producedKg} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{labels.yieldPercent}</p>
                      <p className="font-semibold">
                        {detail.yieldPercent != null ? `${detail.yieldPercent}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{labels.scrapKg}</p>
                      <p className="font-semibold">{detail.scrapKg} kg</p>
                    </div>
                  </div>
                )}

                {message && (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    {message}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
