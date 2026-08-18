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
import { useFormErrors } from "@/hooks/use-form-errors";
import {
  validateDowntimeReason,
  validateQualityCheck,
  validateScrapEntry,
  validateTrackKg,
  validateTrackProgress,
  validateTrackUnits,
} from "@/lib/forms/production-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import { ProductionCompletePanel } from "@/components/production/production-complete-panel";
import { ProductionStageFlow } from "@/components/production/production-stage-flow";
import {
  PRODUCTION_STAGES,
  QUALITY_DECISIONS,
  STAGE_LABELS,
  isLastStage,
  nextStage,
  stageNumber,
  type ProductionStage,
} from "@/lib/production/stages";

interface LiveOrder {
  id: string;
  productionNo: string;
  lotNo: string;
  orderNo: string | null;
  productSku: string | null;
  productName: string | null;
  recipeCode: string;
  currentStage: string;
  currentStageLabel: string;
  currentKg: number;
  plannedKg: number;
  stageProgressPercent: number;
  producedUnits: number;
  scrapKg: number;
  shift: string | null;
  shiftLabel: string | null;
  operatorName: string | null;
  qualityStatus: string | null;
  lineCode: string | null;
}

interface CookerCard {
  lineId: string;
  lineCode: string;
  lineName: string;
  lineStatus: string;
  lineStatusLabel: string;
  activeOrder: LiveOrder | null;
  activeDowntime: {
    id: string;
    reason: string;
    startedAt: string;
  } | null;
}

interface ProcessLineCard {
  lineId: string;
  lineCode: string;
  lineName: string;
  lineStatus: string;
  lineStatusLabel: string;
  dailyTargetUnits: number;
  dailyProducedUnits: number;
  teamSize: number;
  progressPercent: number;
  activeOrders: LiveOrder[];
  activeDowntime: {
    id: string;
    reason: string;
    startedAt: string;
  } | null;
}

interface LiveBoard {
  cookers: CookerCard[];
  cuttingLine: ProcessLineCard | null;
  packagingLine: ProcessLineCard | null;
  potCount: number;
  batchYieldKg: number;
}

interface ProductionLiveBoardProps {
  canEdit: boolean;
  labels: Record<string, string>;
}

export function ProductionLiveBoard({ canEdit, labels }: ProductionLiveBoardProps) {
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const {
    clearErrors,
    clearFieldError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [downtimeReason, setDowntimeReason] = useState("");
  const [scrapKg, setScrapKg] = useState("");
  const [qualityParam, setQualityParam] = useState("");
  const [qualityActual, setQualityActual] = useState("");
  const [qualityDecision, setQualityDecision] = useState("approved");
  const [editKg, setEditKg] = useState("");
  const [editProgress, setEditProgress] = useState("");
  const [editUnits, setEditUnits] = useState("");
  const [editOperator, setEditOperator] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/production/live");
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || labels.liveError);
        return;
      }
      setBoard(data.board);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [clearErrors, labels.connectionError, labels.liveError, showError]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const selectedOrder = findOrder(board, selectedOrderId);

  // Form yalnızca başka bir emir seçildiğinde doldurulur. 30 saniyelik
  // otomatik yenileme `board`'u tazelediğinde kullanıcının yazdığı
  // değerlerin üzerine yazılmamalı.
  useEffect(() => {
    const order = findOrder(board, selectedOrderId);
    if (!order) return;
    setEditKg(String(order.currentKg));
    setEditProgress(String(order.stageProgressPercent));
    setEditUnits(String(order.producedUnits));
    setEditOperator(order.operatorName ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  async function patchTrack(
    orderId: string,
    payload: Record<string, unknown>,
  ) {
    const res = await fetch(`/api/production/orders/${orderId}/track`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || labels.updateError);
    await load();
  }

  async function postTrack(orderId: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/production/orders/${orderId}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || labels.updateError);
    await load();
  }

  async function handleDowntime(lineId: string, action: "start" | "end") {
    if (action === "start" && !applyValidationErrors(validateDowntimeReason(downtimeReason))) {
      return;
    }
    try {
      const res = await fetch(`/api/production/lines/${lineId}/downtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "start"
            ? { reason: downtimeReason, productionOrderId: selectedOrderId || null }
            : { action: "end" },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || labels.downtimeError);
      setDowntimeReason("");
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : labels.downtimeError);
    }
  }

  if (loading && !board) {
    return <p className="text-sm text-muted-foreground">{labels.loadingLive}</p>;
  }

  if (!board) {
    return (
      <>
        {ErrorModal}
        <p className="text-sm text-destructive">{labels.liveError}</p>
      </>
    );
  }

  return (
    <>
      {ErrorModal}
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{labels.liveDesc}</p>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {labels.refreshLive}
        </Button>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">{labels.cookerCards}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {board.cookers.map((cooker) => (
            <Card key={cooker.lineId} className={cooker.activeDowntime ? "border-amber-500" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{cooker.lineName}</CardTitle>
                  <Badge
                    variant={
                      cooker.activeOrder && cooker.lineStatus === "running"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {cooker.lineStatusLabel}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs">{cooker.lineCode}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cooker.activeDowntime && (
                  <p className="text-amber-700 text-xs">
                    {labels.downtimeActive}: {cooker.activeDowntime.reason}
                  </p>
                )}
                {cooker.activeOrder ? (
                  <>
                    <button
                      type="button"
                      className="w-full text-left rounded-md border p-2 hover:bg-muted/50"
                      onClick={() => setSelectedOrderId(cooker.activeOrder!.id)}
                    >
                      <p className="font-mono text-xs font-medium">
                        {cooker.activeOrder.productionNo}
                      </p>
                      <p>{cooker.activeOrder.productSku ?? cooker.activeOrder.recipeCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {labels.stageCount
                          .replace("{current}", String(stageNumber(cooker.activeOrder.currentStage as ProductionStage)))
                          .replace("{total}", String(PRODUCTION_STAGES.length))}
                        {" · "}
                        {cooker.activeOrder.currentStageLabel}
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${cooker.activeOrder.stageProgressPercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs">
                        {cooker.activeOrder.currentKg.toFixed(1)} / {cooker.activeOrder.plannedKg} kg
                        · {cooker.activeOrder.stageProgressPercent}%
                      </p>
                      {cooker.activeOrder.operatorName && (
                        <p className="text-xs text-muted-foreground">
                          {cooker.activeOrder.operatorName}
                          {cooker.activeOrder.shiftLabel && ` · ${cooker.activeOrder.shiftLabel}`}
                        </p>
                      )}
                    </button>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleDowntime(cooker.lineId, "start")}
                        >
                          {labels.downtimeStart}
                        </Button>
                        {cooker.activeDowntime && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => handleDowntime(cooker.lineId, "end")}
                          >
                            {labels.downtimeEnd}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">{labels.noActiveOrder}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {board.cuttingLine && (
          <ProcessLinePanel
            line={board.cuttingLine}
            labels={labels}
            onSelectOrder={setSelectedOrderId}
            canEdit={canEdit}
            onDowntime={handleDowntime}
          />
        )}
        {board.packagingLine && (
          <ProcessLinePanel
            line={board.packagingLine}
            labels={labels}
            onSelectOrder={setSelectedOrderId}
            canEdit={canEdit}
            onDowntime={handleDowntime}
          />
        )}
      </div>

      {canEdit && selectedOrder && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{labels.controlPanel}</CardTitle>
            <CardDescription>
              {selectedOrder.productionNo} · {selectedOrder.productSku ?? selectedOrder.recipeCode}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProductionStageFlow currentStage={selectedOrder.currentStage} />

            {(() => {
              const stage = selectedOrder.currentStage as ProductionStage;
              const next = nextStage(stage);
              const onLast = isLastStage(stage);

              return (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>
                    <span className="text-muted-foreground">{labels.currentStage}:</span>{" "}
                    <strong>{selectedOrder.currentStageLabel}</strong>
                    <span className="ml-1 text-xs text-muted-foreground">
                      (
                      {labels.stageCount
                        .replace("{current}", String(stageNumber(stage)))
                        .replace("{total}", String(PRODUCTION_STAGES.length))}
                      )
                    </span>
                  </span>
                  {next && !onLast && (
                    <span>
                      <span className="text-muted-foreground">{labels.nextStageLabel}:</span>{" "}
                      <strong>{STAGE_LABELS[next]}</strong>
                    </span>
                  )}
                  {onLast && (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {labels.finishBatchHint}
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>{labels.currentKg}</Label>
                <Input
                  type="number"
                  value={editKg}
                  onChange={(e) => setEditKg(e.target.value)}
                  onBlur={() => {
                    if (!applyValidationErrors(validateTrackKg(editKg))) return;
                    patchTrack(selectedOrder.id, { currentKg: editKg }).catch((err) =>
                      showError(err.message),
                    );
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>{labels.progressPercent}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editProgress}
                  onChange={(e) => setEditProgress(e.target.value)}
                  onBlur={() => {
                    if (!applyValidationErrors(validateTrackProgress(editProgress))) return;
                    patchTrack(selectedOrder.id, {
                      stageProgressPercent: editProgress,
                    }).catch((err) => showError(err.message));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>{labels.producedUnitsToday}</Label>
                <Input
                  type="number"
                  value={editUnits}
                  onChange={(e) => setEditUnits(e.target.value)}
                  onBlur={() => {
                    if (!applyValidationErrors(validateTrackUnits(editUnits))) return;
                    patchTrack(selectedOrder.id, { producedUnits: editUnits }).catch((err) =>
                      showError(err.message),
                    );
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>{labels.operator}</Label>
                <Input
                  value={editOperator}
                  onChange={(e) => setEditOperator(e.target.value)}
                  onBlur={() =>
                    patchTrack(selectedOrder.id, { operatorName: editOperator }).catch((err) =>
                      showError(err.message),
                    )
                  }
                />
              </div>
            </div>

            {(() => {
              const stage = selectedOrder.currentStage as ProductionStage;
              const next = nextStage(stage);
              const onLast = isLastStage(stage);

              if (onLast) {
                return (
                  <ProductionCompletePanel
                    orderId={selectedOrder.id}
                    labels={labels}
                    onCompleted={() => {
                      setSelectedOrderId("");
                      void load();
                    }}
                  />
                );
              }

              return (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      patchTrack(selectedOrder.id, { action: "advance_stage" }).catch((err) =>
                        showError(err.message),
                      )
                    }
                  >
                    {next
                      ? labels.advanceTo.replace("{stage}", STAGE_LABELS[next])
                      : labels.advanceStage}
                  </Button>
                </div>
              );
            })()}

            <div className="grid gap-3 sm:grid-cols-3 border-t pt-3">
              <div className="space-y-1">
                <Label>{labels.scrapEntry}</Label>
                <Input
                  value={scrapKg}
                  onChange={(e) => {
                    setScrapKg(sanitizeDecimalInput(e.target.value));
                    clearFieldError("scrapKg");
                  }}
                  placeholder="kg"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="self-end"
                onClick={() => {
                  if (!applyValidationErrors(validateScrapEntry(scrapKg))) return;
                  postTrack(selectedOrder.id, {
                    action: "scrap",
                    quantityKg: Number(scrapKg),
                  })
                    .then(() => setScrapKg(""))
                    .catch((err) => showError(err.message));
                }}
              >
                {labels.recordScrap}
              </Button>
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label>{labels.qualityCheck}</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder={labels.qualityParam}
                  value={qualityParam}
                  onChange={(e) => setQualityParam(e.target.value)}
                />
                <Input
                  placeholder={labels.qualityActual}
                  value={qualityActual}
                  onChange={(e) => setQualityActual(e.target.value)}
                />
                <select
                  className="flex h-9 rounded-md border px-3 text-sm"
                  value={qualityDecision}
                  onChange={(e) => setQualityDecision(e.target.value)}
                >
                  {QUALITY_DECISIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (
                    !applyValidationErrors(
                      validateQualityCheck({
                        parameter: qualityParam,
                        actualValue: qualityActual,
                      }),
                    )
                  ) {
                    return;
                  }
                  postTrack(selectedOrder.id, {
                    action: "quality_check",
                    stage: selectedOrder.currentStage,
                    parameter: qualityParam,
                    actualValue: qualityActual,
                    compliance: qualityDecision,
                  })
                    .then(() => {
                      setQualityParam("");
                      setQualityActual("");
                    })
                    .catch((err) => showError(err.message));
                }}
              >
                {labels.saveQuality}
              </Button>
            </div>

            <div className="space-y-1 border-t pt-3">
              <Label>{labels.downtimeReason}</Label>
              <Input
                value={downtimeReason}
                onChange={(e) => setDowntimeReason(e.target.value)}
                placeholder={labels.downtimeReasonPlaceholder}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}

function ProcessLinePanel({
  line,
  labels,
  onSelectOrder,
  canEdit,
  onDowntime,
}: {
  line: ProcessLineCard;
  labels: Record<string, string>;
  onSelectOrder: (id: string) => void;
  canEdit: boolean;
  onDowntime: (lineId: string, action: "start" | "end") => void;
}) {
  return (
    <Card className={line.activeDowntime ? "border-amber-500" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{line.lineName}</CardTitle>
          <Badge variant="secondary">{line.lineStatusLabel}</Badge>
        </div>
        <CardDescription>
          {labels.dailyOutput}: {line.dailyProducedUnits} / {line.dailyTargetUnits}
          {labels.unitPieceShort} · {line.teamSize} {labels.teamMembers}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-emerald-600 transition-all"
            style={{ width: `${line.progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{line.progressPercent}% {labels.ofTarget}</p>
        {line.activeDowntime && (
          <p className="text-xs text-amber-700">{line.activeDowntime.reason}</p>
        )}
        {line.activeOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.noActiveOrder}</p>
        ) : (
          line.activeOrders.map((o) => (
            <button
              key={o.id}
              type="button"
              className="w-full rounded-md border p-2 text-left text-xs hover:bg-muted/50"
              onClick={() => onSelectOrder(o.id)}
            >
              <span className="font-mono">{o.productionNo}</span> · {o.productSku}
              <span className="text-muted-foreground"> · {o.currentStageLabel}</span>
              {o.producedUnits > 0 && ` · ${o.producedUnits} ${labels.unitPieceShort}`}
            </button>
          ))
        )}
        {canEdit && (
          <div className="flex gap-1 pt-1">
            <Button size="sm" variant="outline" onClick={() => onDowntime(line.lineId, "start")}>
              {labels.downtimeStart}
            </Button>
            {line.activeDowntime && (
              <Button size="sm" variant="outline" onClick={() => onDowntime(line.lineId, "end")}>
                {labels.downtimeEnd}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function findOrder(board: LiveBoard | null, id: string): LiveOrder | null {
  if (!board || !id) return null;
  for (const c of board.cookers) {
    if (c.activeOrder?.id === id) return c.activeOrder;
  }
  if (board.cuttingLine) {
    const o = board.cuttingLine.activeOrders.find((x) => x.id === id);
    if (o) return o;
  }
  if (board.packagingLine) {
    const o = board.packagingLine.activeOrders.find((x) => x.id === id);
    if (o) return o;
  }
  return null;
}
