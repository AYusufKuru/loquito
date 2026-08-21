"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import { PromptDialog } from "@/components/ui/prompt-dialog";
import {
  TrackingPanel,
  listTrackingBadgeLabel,
  listTrackingBadgeVariant,
} from "@/components/shipments/tracking-panel";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { isCorreiosTrackingCode } from "@/lib/correios/code";
import { apiFetch } from "@/lib/http";
import {
  validateCreateShipment,
  validateDispatchShipment,
  validateIssueUnits,
  validatePalletCount,
} from "@/lib/forms/shipment-validation";
import { sanitizeIntInput } from "@/lib/forms/validation";
import { CHECKLIST_FIELDS } from "@/lib/shipments/constants";
import type { SerializedShipment } from "@/lib/shipments/serialize";
import type { OrderShippingProgress } from "@/lib/shipments/types";

interface OrderOption {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
  deliveryDate: string | null;
}

interface LineDraft {
  orderItemId: string;
  boxCount: string;
  unitCount: string;
  lotNo: string;
  heldUnitCount: string;
  heldLotNo: string;
}

interface ShipmentsSectionProps {
  initialShipments: SerializedShipment[];
  shippableOrders: OrderOption[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  correiosConfigured: boolean;
  labels: Record<string, string>;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "delivered") return "default";
  if (status === "issue" || status === "returned") return "destructive";
  if (status === "in_transit" || status === "loaded") return "secondary";
  return "outline";
}

export function ShipmentsSection({
  initialShipments,
  shippableOrders,
  canCreate,
  canEdit,
  canDelete,
  correiosConfigured,
  labels,
}: ShipmentsSectionProps) {
  const [shipments, setShipments] = useLiveState(initialShipments);
  const [selectedOrderId, setSelectedOrderId] = useState(shippableOrders[0]?.id ?? "");
  const [progress, setProgress] = useState<OrderShippingProgress | null>(null);
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [plannedShipDate, setPlannedShipDate] = useState("");
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [detail, setDetail] = useState<SerializedShipment | null>(null);
  const [carrierName, setCarrierName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [palletCount, setPalletCount] = useState("");
  const [sealNo, setSealNo] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [proofNo, setProofNo] = useState("");
  const [issueShortage, setIssueShortage] = useState("");
  const [issueDamage, setIssueDamage] = useState("");
  const [issueReturn, setIssueReturn] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SerializedShipment | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const checklistComplete = useMemo(
    () => CHECKLIST_FIELDS.every((field) => checklist[field]),
    [checklist],
  );

  const loadProgress = useCallback(async (orderId: string) => {
    if (!orderId) {
      setProgress(null);
      setLineDrafts([]);
      return;
    }
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/shipments/orders/${orderId}/progress`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      const p = data.progress as OrderShippingProgress;
      setProgress(p);
      setLineDrafts(
        p.lines
          .filter((l) => l.remainingUnits > 0)
          .map((l) => ({
            orderItemId: l.orderItemId,
            boxCount: String(Math.min(l.remainingBoxes, l.remainingBoxes)),
            unitCount: String(l.remainingUnits),
            lotNo: "",
            heldUnitCount: "",
            heldLotNo: "",
          })),
      );
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError, clearErrors, showApiError, showError]);

  useEffect(() => {
    if (selectedOrderId) loadProgress(selectedOrderId);
  }, [selectedOrderId, loadProgress]);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/shipments/${id}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      const shipment = data.shipment as SerializedShipment;
      setDetail(shipment);
      setCarrierName(shipment.carrierName ?? "");
      setDriverName(shipment.driverName ?? "");
      setVehiclePlate(shipment.vehiclePlate ?? "");
      setTrackingNo(shipment.trackingNo ?? "");
      setPalletCount(String(shipment.palletCount || ""));
      setSealNo(shipment.sealNo ?? "");
      setReceivedBy(shipment.receivedBy ?? "");
      setProofNo(shipment.proofNo ?? "");
      setIssueShortage(String(shipment.issueShortageUnits || ""));
      setIssueDamage(String(shipment.issueDamageUnits || ""));
      setIssueReturn(String(shipment.issueReturnUnits || ""));
      setIssueNotes(shipment.issueNotes ?? "");
      setChecklist({
        checkStockReserved: shipment.checkStockReserved,
        checkLotExpiry: shipment.checkLotExpiry,
        checkLabels: shipment.checkLabels,
        checkQuantities: shipment.checkQuantities,
        checkBoxCount: shipment.checkBoxCount,
        checkDocuments: shipment.checkDocuments,
        checkDamage: shipment.checkDamage,
      });
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError, clearErrors, showApiError, showError]);

  const refreshList = useCallback(async () => {
    const res = await apiFetch("/api/shipments");
    const data = await res.json();
    if (res.ok) setShipments(data.shipments);
  }, []);

  const handleCreate = async () => {
    if (!canCreate || !selectedOrderId) return;
    if (
      !applyValidationErrors(
        validateCreateShipment({
          orderId: selectedOrderId,
          orderLabel: labels.selectOrder,
          lineDrafts,
          progressLines:
            progress?.lines.map((l) => ({
              orderItemId: l.orderItemId,
              sku: l.sku,
              remainingUnits: l.remainingUnits,
            })) ?? [],
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    clearErrors();
    try {
      const items = lineDrafts
        .filter((l) => Number(l.unitCount) > 0 || Number(l.heldUnitCount) > 0)
        .map((l) => ({
          orderItemId: l.orderItemId,
          boxCount: Math.max(0, Math.floor(Number(l.boxCount) || 0)),
          unitCount: Math.max(0, Math.floor(Number(l.unitCount) || 0)),
          lotNo: l.lotNo.trim() || null,
          heldUnitCount: Math.max(0, Math.floor(Number(l.heldUnitCount) || 0)),
          heldLotNo: l.heldLotNo.trim() || null,
        }));

      const res = await apiFetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrderId,
          plannedShipDate: plannedShipDate || null,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.createError);
        return;
      }
      setMessage(labels.created);
      await refreshList();
      setSelectedShipmentId(data.shipment.id);
      await loadDetail(data.shipment.id);
      await loadProgress(selectedOrderId);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const patchShipment = async (patch: Record<string, unknown>) => {
    if (!canEdit || !detail) return false;
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/shipments/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return false;
      }
      setDetail(data.shipment);
      await refreshList();
      if (selectedOrderId) await loadProgress(selectedOrderId);
      setMessage(labels.saved);
      return true;
    } catch {
      showError(labels.connectionError);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCarrier = async () => {
    if (!applyValidationErrors(validatePalletCount(palletCount))) return false;
    return patchShipment({
      carrierName,
      driverName,
      vehiclePlate,
      trackingNo,
      palletCount: Number(palletCount) || 0,
      sealNo,
    });
  };

  const handleRefreshTracking = async () => {
    if (!detail) return;
    if (canEdit && trackingNo.trim() !== (detail.trackingNo ?? "")) {
      const saved = await handleSaveCarrier();
      if (!saved) return;
    }
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/shipments/${detail.id}/track`, { method: "POST" });
      const data = await res.json();
      if (data.shipment) {
        setDetail(data.shipment);
        setTrackingNo(data.shipment.trackingNo ?? "");
        await refreshList();
      }
      if (!res.ok) {
        showApiError(data, labels.trackingRefreshError);
        return;
      }
      setMessage(labels.trackingRefreshed);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChecklist = () =>
    patchShipment({
      ...checklist,
    });

  const handleDispatch = async () => {
    if (!canEdit || !detail) return;
    if (
      !applyValidationErrors(
        validateDispatchShipment({
          carrierName,
          checklist,
        }),
      )
    ) {
      return;
    }

    const saved = await handleSaveCarrier();
    if (!saved) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/shipments/${detail.id}/dispatch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.dispatchError);
        return;
      }
      setDetail(data.shipment);
      setMessage(labels.dispatched);
      await refreshList();
      if (selectedOrderId) await loadProgress(selectedOrderId);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const handleDelivered = () => {
    if (!applyValidationErrors(validateIssueUnits({
      shortage: issueShortage,
      damage: issueDamage,
      returnUnits: issueReturn,
    }))) {
      return;
    }
    return patchShipment({
      status: "delivered",
      receivedBy,
      proofNo,
      issueShortageUnits: Number(issueShortage) || 0,
      issueDamageUnits: Number(issueDamage) || 0,
      issueReturnUnits: Number(issueReturn) || 0,
      issueNotes,
    });
  };

  const handleIssue = () => {
    if (!applyValidationErrors(validateIssueUnits({
      shortage: issueShortage,
      damage: issueDamage,
      returnUnits: issueReturn,
    }))) {
      return;
    }
    return patchShipment({
      status: "issue",
      issueShortageUnits: Number(issueShortage) || 0,
      issueDamageUnits: Number(issueDamage) || 0,
      issueReturnUnits: Number(issueReturn) || 0,
      issueNotes,
    });
  };

  const canRequestDelete = (shipment: SerializedShipment) =>
    canDelete && shipment.status === "planned" && !shipment.pendingDelete;

  const openDeleteDialog = (id: string) => {
    const shipment =
      shipments.find((row) => row.id === id) ??
      (detail?.id === id ? detail : null);
    if (!shipment || !canRequestDelete(shipment)) return;
    setDeleteTarget(shipment);
    setDeleteReason("");
  };

  const handleDeleteRequest = async () => {
    if (!deleteTarget || !canDelete) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/shipments/${deleteTarget.id}/delete-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.deleteError);
        return;
      }
      setShipments((prev) =>
        prev.map((row) =>
          row.id === deleteTarget.id ? { ...row, pendingDelete: true } : row,
        ),
      );
      if (detail?.id === deleteTarget.id) {
        setDetail({ ...detail, pendingDelete: true });
      }
      setDeleteTarget(null);
      setDeleteReason("");
      setMessage(labels.deleteRequestSent);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const checklistLabel = (field: string) => labels[field] ?? field;

  return (
    <>
      {ErrorModal}
      <PromptDialog
        open={Boolean(deleteTarget)}
        title={labels.deleteReasonTitle}
        description={
          deleteTarget
            ? `${labels.deleteReasonDesc} ${deleteTarget.shipmentNo}`
            : labels.deleteReasonDesc
        }
        label={labels.deleteReason}
        placeholder={labels.deleteReasonPlaceholder}
        confirmLabel={labels.submitDeleteRequest}
        cancelLabel={labels.cancel}
        value={deleteReason}
        submitting={loading}
        onChange={setDeleteReason}
        onConfirm={() => {
          void handleDeleteRequest();
        }}
        onCancel={() => {
          if (!loading) {
            setDeleteTarget(null);
            setDeleteReason("");
          }
        }}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{labels.listTitle}</CardTitle>
            <Button variant="outline" size="sm" onClick={refreshList} disabled={loading}>
              {labels.refresh}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.noShipments}</p>
            ) : (
              shipments.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-stretch rounded-lg border transition hover:bg-muted/50 ${
                    selectedShipmentId === s.id ? "border-primary bg-muted/30" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShipmentId(s.id);
                      loadDetail(s.id);
                    }}
                    className="min-w-0 flex-1 p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.shipmentNo}</span>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        {listTrackingBadgeLabel(s.trackingStatus, labels) && (
                          <Badge variant={listTrackingBadgeVariant(s.trackingStatus)}>
                            {listTrackingBadgeLabel(s.trackingStatus, labels)}
                          </Badge>
                        )}
                        <Badge variant={statusVariant(s.status)}>{s.statusLabel}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.orderNo} · {s.customerName}
                    </p>
                  </button>
                  {canRequestDelete(s) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="m-2 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => openDeleteDialog(s.id)}
                      disabled={loading}
                    >
                      {labels.delete}
                    </Button>
                  ) : s.pendingDelete ? (
                    <span className="m-2 shrink-0 self-center text-xs text-muted-foreground">
                      {labels.deletePending}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {canCreate && (
          <Card>
            <CardHeader>
              <CardTitle>{labels.newShipment}</CardTitle>
              <CardDescription>{labels.partialShipDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label={labels.selectOrder} error={fieldError("orderId")} required>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    clearFieldError("orderId");
                  }}
                >
                  {shippableOrders.length === 0 ? (
                    <option value="">{labels.noOrders}</option>
                  ) : (
                    shippableOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNo} — {o.customerName}
                      </option>
                    ))
                  )}
                </select>
              </FormField>

              {progress && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{labels.progressTitle}</p>
                  <p className="text-muted-foreground">
                    {progress.totalShippedUnits} / {progress.totalOrderedUnits} {labels.shipUnits}
                    {progress.isFullyShipped ? ` · ${labels.fullyShipped}` : ` · ${labels.partiallyShipped}`}
                  </p>
                </div>
              )}

              <div>
                <Label>{labels.plannedShipDate}</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={plannedShipDate}
                  onChange={(e) => setPlannedShipDate(e.target.value)}
                />
              </div>

              {lineDrafts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{labels.partialShipTitle}</p>
                  {lineDrafts.map((draft, idx) => {
                    const line = progress?.lines.find((l) => l.orderItemId === draft.orderItemId);
                    const warehouseQty = Number(draft.unitCount) || 0;
                    const heldQty = Number(draft.heldUnitCount) || 0;
                    const remaining = line?.remainingUnits ?? 0;
                    const total = warehouseQty + heldQty;
                    return (
                      <div key={draft.orderItemId} className="rounded-md border p-3 space-y-2">
                        <p className="text-sm font-medium">
                          {line?.sku} — {line?.flavorName} {line?.packagingLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {labels.orderedUnits}: {line?.orderedUnits} · {labels.shippedUnits}:{" "}
                          {line?.shippedUnits} · {labels.remainingUnits}: {line?.remainingUnits}
                          {(line?.separatedUnits ?? 0) > 0
                            ? ` · ${labels.heldAvailable}: ${line?.separatedUnits}`
                            : ""}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">{labels.shipBoxes}</Label>
                            <Input
                              value={draft.boxCount}
                              onChange={(e) => {
                                const next = [...lineDrafts];
                                next[idx] = {
                                  ...draft,
                                  boxCount: sanitizeIntInput(e.target.value),
                                };
                                setLineDrafts(next);
                                clearFieldError(`line-${idx}-boxes`);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{labels.shipUnits}</Label>
                            <Input
                              value={draft.unitCount}
                              onChange={(e) => {
                                const nextWarehouse = Number(sanitizeIntInput(e.target.value)) || 0;
                                const held = Number(draft.heldUnitCount) || 0;
                                const capped = Math.max(0, Math.min(nextWarehouse, remaining - held));
                                const next = [...lineDrafts];
                                next[idx] = {
                                  ...draft,
                                  unitCount: capped ? String(capped) : "",
                                };
                                setLineDrafts(next);
                                clearFieldError(`line-${idx}-units`);
                                clearFieldError("lines");
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{labels.lotNo}</Label>
                            <Input
                              value={draft.lotNo}
                              onChange={(e) => {
                                const next = [...lineDrafts];
                                next[idx] = { ...draft, lotNo: e.target.value };
                                setLineDrafts(next);
                              }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">{labels.heldUnits}</Label>
                            <Input
                              value={draft.heldUnitCount}
                              onChange={(e) => {
                                const rawHeld = Number(sanitizeIntInput(e.target.value)) || 0;
                                const prevHeld = Number(draft.heldUnitCount) || 0;
                                const prevWarehouse = Number(draft.unitCount) || 0;
                                const nextHeld = Math.max(0, Math.min(rawHeld, remaining));
                                const nextWarehouse = Math.max(
                                  0,
                                  Math.min(prevWarehouse + prevHeld - nextHeld, remaining - nextHeld),
                                );
                                const next = [...lineDrafts];
                                next[idx] = {
                                  ...draft,
                                  heldUnitCount: nextHeld ? String(nextHeld) : "",
                                  unitCount: nextWarehouse ? String(nextWarehouse) : "",
                                  heldLotNo:
                                    nextHeld === 0
                                      ? ""
                                      : draft.heldLotNo || line?.separatedLots[0]?.lotNo || "",
                                };
                                setLineDrafts(next);
                                clearFieldError(`line-${idx}-held`);
                                clearFieldError(`line-${idx}-held-lot`);
                                clearFieldError(`line-${idx}-units`);
                                clearFieldError("lines");
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{labels.heldLotNo}</Label>
                            <Input
                              value={draft.heldLotNo}
                              onChange={(e) => {
                                const next = [...lineDrafts];
                                next[idx] = { ...draft, heldLotNo: e.target.value };
                                setLineDrafts(next);
                                clearFieldError(`line-${idx}-held-lot`);
                              }}
                              list={`held-lots-${draft.orderItemId}`}
                            />
                            <datalist id={`held-lots-${draft.orderItemId}`}>
                              {(line?.separatedLots ?? []).map((lot) => (
                                <option key={`${lot.lotNo}-${lot.quantity}`} value={lot.lotNo}>
                                  {lot.lotNo} ({lot.quantity})
                                </option>
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <Label className="text-xs">{labels.shipTotal}</Label>
                            <p className="mt-2 text-sm font-medium">{total}</p>
                          </div>
                        </div>
                        {fieldError(`line-${idx}-held`) && (
                          <p className="text-xs text-destructive">{fieldError(`line-${idx}-held`)}</p>
                        )}
                        {fieldError(`line-${idx}-held-lot`) && (
                          <p className="text-xs text-destructive">{fieldError(`line-${idx}-held-lot`)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {fieldError("lines") && (
                <p className="text-sm text-destructive">{fieldError("lines")}</p>
              )}

              <Button onClick={handleCreate} disabled={loading || !selectedOrderId}>
                {loading ? labels.creating : labels.createShipment}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{labels.detailTitle}</CardTitle>
          {detail && (
            <CardDescription>
              {detail.shipmentNo} · {detail.orderNo}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {!detail ? (
            <p className="text-sm text-muted-foreground">{labels.selectOrder}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(detail.status)}>{detail.statusLabel}</Badge>
                {detail.actualShipDate && (
                  <Badge variant="outline">
                    {labels.actualShipDate}: {detail.actualShipDate}
                  </Badge>
                )}
                {canRequestDelete(detail) ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="ml-auto"
                    onClick={() => openDeleteDialog(detail.id)}
                    disabled={loading}
                  >
                    {labels.delete}
                  </Button>
                ) : detail.pendingDelete ? (
                  <Badge variant="outline" className="ml-auto">
                    {labels.deletePending}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={labels.carrierName} error={fieldError("carrierName")} required>
                  <Input
                    className="mt-1"
                    value={carrierName}
                    onChange={(e) => {
                      setCarrierName(e.target.value);
                      clearFieldError("carrierName");
                    }}
                    disabled={!canEdit}
                  />
                </FormField>
                <div>
                  <Label>{labels.driverName}</Label>
                  <Input className="mt-1" value={driverName} onChange={(e) => setDriverName(e.target.value)} disabled={!canEdit} />
                </div>
                <div>
                  <Label>{labels.vehiclePlate}</Label>
                  <Input className="mt-1" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} disabled={!canEdit} />
                </div>
                <div>
                  <Label>{labels.trackingNo}</Label>
                  <Input
                    className="mt-1"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    disabled={!canEdit}
                    placeholder="AA123456789BR"
                  />
                  <p
                    className={`mt-1 text-xs ${
                      trackingNo.trim() && !isCorreiosTrackingCode(trackingNo)
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {trackingNo.trim() && !isCorreiosTrackingCode(trackingNo)
                      ? labels.trackingInvalidCode
                      : labels.trackingNoHint}
                  </p>
                </div>
                <FormField label={labels.palletCount} error={fieldError("palletCount")}>
                  <Input
                    className="mt-1"
                    value={palletCount}
                    onChange={(e) => {
                      setPalletCount(sanitizeIntInput(e.target.value));
                      clearFieldError("palletCount");
                    }}
                    disabled={!canEdit}
                  />
                </FormField>
                <div>
                  <Label>{labels.sealNo}</Label>
                  <Input className="mt-1" value={sealNo} onChange={(e) => setSealNo(e.target.value)} disabled={!canEdit} />
                </div>
              </div>

              {canEdit && (
                <Button variant="outline" onClick={handleSaveCarrier} disabled={loading}>
                  {labels.saveCarrier}
                </Button>
              )}

              <TrackingPanel
                shipment={detail}
                draftTrackingNo={trackingNo}
                configured={correiosConfigured}
                loading={loading}
                labels={labels}
                onRefresh={() => {
                  void handleRefreshTracking();
                }}
              />

              <div>
                <p className="mb-2 font-medium">{labels.checklistTitle}</p>
                <div className="space-y-2">
                  {CHECKLIST_FIELDS.map((field) => (
                    <label key={field} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checklist[field] ?? false}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setChecklist((prev) => ({ ...prev, [field]: e.target.checked }))
                        }
                      />
                      {checklistLabel(field)}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {checklistComplete ? labels.checklistComplete : labels.checklistIncomplete}
                </p>
                {fieldError("checklist") && (
                  <p className="mt-1 text-xs text-destructive">{fieldError("checklist")}</p>
                )}
                {canEdit && (
                  <Button variant="outline" className="mt-2" onClick={handleSaveChecklist} disabled={loading}>
                    {labels.saveChecklist}
                  </Button>
                )}
              </div>

              {detail.items.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">{labels.partialShipTitle}</p>
                  {detail.items.map((item) => (
                    <div key={item.id} className="rounded border p-2 text-sm">
                      <span className="font-medium">{item.sku}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {item.boxCount} koli / {item.unitCount} adet
                        {item.lotNo ? ` · Lot ${item.lotNo}` : ""}
                        {item.heldUnitCount > 0
                          ? ` · ${labels.heldUnits}: ${item.heldUnitCount}${item.heldLotNo ? ` (${item.heldLotNo})` : ""}`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {canEdit && detail.status !== "in_transit" && detail.status !== "delivered" && (
                <Button onClick={handleDispatch} disabled={loading}>
                  {loading ? labels.dispatching : labels.dispatch}
                </Button>
              )}

              <div>
                <p className="mb-2 font-medium">{labels.issueTitle}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>{labels.issueShortage}</Label>
                    <Input
                      className="mt-1"
                      value={issueShortage}
                      onChange={(e) => {
                        setIssueShortage(sanitizeIntInput(e.target.value));
                        clearFieldError("issueShortage");
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label>{labels.issueDamage}</Label>
                    <Input
                      className="mt-1"
                      value={issueDamage}
                      onChange={(e) => {
                        setIssueDamage(sanitizeIntInput(e.target.value));
                        clearFieldError("issueDamage");
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label>{labels.issueReturn}</Label>
                    <Input
                      className="mt-1"
                      value={issueReturn}
                      onChange={(e) => {
                        setIssueReturn(sanitizeIntInput(e.target.value));
                        clearFieldError("issueReturn");
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label>{labels.issueNotes}</Label>
                  <Input className="mt-1" value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{labels.receivedBy}</Label>
                    <Input className="mt-1" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} disabled={!canEdit} />
                  </div>
                  <div>
                    <Label>{labels.proofNo}</Label>
                    <Input className="mt-1" value={proofNo} onChange={(e) => setProofNo(e.target.value)} disabled={!canEdit} />
                  </div>
                </div>
                {canEdit && detail.status === "in_transit" && (
                  <div className="mt-3 flex gap-2">
                    <Button onClick={handleDelivered} disabled={loading}>{labels.markDelivered}</Button>
                    <Button variant="destructive" onClick={handleIssue} disabled={loading}>
                      {labels.markIssue}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {message && <p className="text-sm text-green-600">{message}</p>}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
