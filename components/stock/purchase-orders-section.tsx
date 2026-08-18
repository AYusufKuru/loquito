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
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormErrors } from "@/hooks/use-form-errors";
import {
  validatePurchaseOrderForm,
  validatePurchaseReceiveForm,
} from "@/lib/forms/stock-validation";
import { sanitizeDecimalInput, sanitizeMoneyInput } from "@/lib/forms/validation";
import { formatBrlFromCents, parseBrlToCents } from "@/lib/stock/constants";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_TRANSITIONS,
  type PurchaseOrderStatus,
} from "@/lib/stock/purchase-order-constants";
import type {
  MaterialRow,
  PurchaseOrderRow,
  StockCapabilities,
  SupplierOption,
} from "@/lib/stock/types";

interface LineDraft {
  materialId: string;
  quantity: string;
  unitPrice: string;
}

interface PurchaseOrdersSectionProps {
  materials: MaterialRow[];
  suppliers: SupplierOption[];
  capabilities: StockCapabilities;
  labels: Record<string, string>;
  onStockReceived?: () => void;
}

function emptyLine(materials: MaterialRow[]): LineDraft {
  const first = materials[0];
  return {
    materialId: first?.id ?? "",
    quantity: "",
    unitPrice: first ? String((first.unitPriceCents / 100).toFixed(2)).replace(".", ",") : "0",
  };
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  ordered: "default",
  partial: "outline",
  received: "outline",
  cancelled: "destructive",
};

export function PurchaseOrdersSection({
  materials,
  suppliers,
  capabilities,
  labels,
  onStockReceived,
}: PurchaseOrdersSectionProps) {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(materials)]);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
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

  const activeMaterials = materials.filter((m) => m.isActive && !m.isDailySupply);

  const load = useCallback(async () => {
    setLoading(true);
    clearErrors();
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/stock/purchase-orders${q}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setOrders(data.orders);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, labels.loadError, labels.connectionError, clearErrors, showApiError, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );

  function statusLabel(status: string) {
    const key = `poStatus_${status}`;
    return labels[key] ?? PURCHASE_ORDER_STATUS_LABELS[status as PurchaseOrderStatus] ?? status;
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setSupplierId(suppliers[0]?.id ?? "");
    setDeliveryDate("");
    setNotes("");
    setLines([emptyLine(activeMaterials)]);
    clearErrors();
    setMessage("");
  }

  function selectOrder(order: PurchaseOrderRow) {
    setIsCreating(false);
    setSelectedId(order.id);
    setReceiveQty({});
    clearErrors();
    setMessage("");
  }

  async function handleCreate() {
    if (!capabilities.canCreate) return;
    if (
      !applyValidationErrors(
        validatePurchaseOrderForm({ supplierId, lines }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");

    const payload = {
      supplierId,
      deliveryDate: deliveryDate || null,
      notes: notes.trim() || null,
      lines: lines
        .filter((l) => l.materialId && Number(l.quantity) > 0)
        .map((l) => ({
          materialId: l.materialId,
          quantity: Number(l.quantity),
          unitPriceCents: parseBrlToCents(l.unitPrice) ?? 0,
        })),
    };

    try {
      const res = await fetch("/api/stock/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setOrders((prev) => [data.order, ...prev]);
      selectOrder(data.order);
      setMessage(labels.poCreated);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(status: PurchaseOrderStatus) {
    if (!selected || !capabilities.canEdit) return;
    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await fetch(`/api/stock/purchase-orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
      setMessage(labels.poStatusUpdated);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleReceive() {
    if (!selected || !capabilities.canEdit) return;

    const receiveLines = selected.items
      .map((item) => ({
        itemId: item.id,
        quantity: receiveQty[item.id] ?? "",
        maxQty: item.quantity - item.receivedQty,
      }))
      .filter((l) => l.maxQty > 0);

    if (
      !applyValidationErrors(validatePurchaseReceiveForm(receiveLines))
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");

    const payload = {
      lines: receiveLines
        .filter((l) => l.quantity.trim())
        .map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
        })),
    };

    try {
      const res = await fetch(
        `/api/stock/purchase-orders/${selected.id}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
      setReceiveQty({});
      setMessage(labels.poReceivedOk);
      onStockReceived?.();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.materialId) {
          const mat = activeMaterials.find((m) => m.id === patch.materialId);
          if (mat) {
            next.unitPrice = String((mat.unitPriceCents / 100).toFixed(2)).replace(".", ",");
          }
        }
        return next;
      }),
    );
  }

  const nextStatuses = selected
    ? PURCHASE_ORDER_STATUS_TRANSITIONS[selected.status].filter(
        (s) => s !== "partial" && s !== "received",
      )
    : [];

  const canReceive =
    selected &&
    selected.status !== "cancelled" &&
    selected.status !== "received" &&
    selected.items.some((i) => i.receivedQty < i.quantity);

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{labels.poTitle}</CardTitle>
                <CardDescription>{labels.poDesc}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">{labels.allStatuses}</option>
                  {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {labels[`poStatus_${value}`] ?? label}
                    </option>
                  ))}
                </select>
                {capabilities.canCreate && (
                  <Button size="sm" variant="outline" onClick={startCreate}>
                    + {labels.poNew}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">{labels.poOrderNo}</th>
                    <th className="px-3 py-2">{labels.colSupplier}</th>
                    <th className="px-3 py-2">{labels.date}</th>
                    <th className="px-3 py-2">{labels.status}</th>
                    <th className="px-3 py-2">{labels.poTotal}</th>
                    <th className="px-3 py-2">{labels.poItems}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className={`cursor-pointer border-b last:border-0 hover:bg-muted/40 ${
                        selectedId === order.id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => selectOrder(order)}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{order.orderNo}</td>
                      <td className="px-3 py-2">{order.supplierName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(order.orderDate).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
                          {statusLabel(order.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{formatBrlFromCents(order.totalCents)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {order.items.length}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        {labels.poNoOrders}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isCreating && capabilities.canCreate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{labels.poNew}</CardTitle>
                <CardDescription>{labels.poNewDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  label={labels.colSupplier}
                  error={fieldError("supplierId")}
                  required
                >
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(e.target.value);
                      clearFieldError("supplierId");
                    }}
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="space-y-2">
                  <Label>{labels.poExpectedDate}</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>{labels.poLines}</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLines((p) => [...p, emptyLine(activeMaterials)])}
                    >
                      + {labels.poAddLine}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {lines.map((line, index) => (
                      <div key={index} className="rounded-lg border p-2 space-y-2">
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={line.materialId}
                          onChange={(e) => {
                            updateLine(index, { materialId: e.target.value });
                            clearFieldError(`line-${index}-material`);
                            clearFieldError("lines");
                          }}
                        >
                          {activeMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} — {m.name}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder={labels.quantity}
                            value={line.quantity}
                            onChange={(e) => {
                              updateLine(index, {
                                quantity: sanitizeDecimalInput(e.target.value),
                              });
                              clearFieldError(`line-${index}-qty`);
                            }}
                          />
                          <Input
                            placeholder={labels.colPrice}
                            value={line.unitPrice}
                            onChange={(e) => {
                              updateLine(index, {
                                unitPrice: sanitizeMoneyInput(e.target.value),
                              });
                              clearFieldError(`line-${index}-price`);
                            }}
                          />
                        </div>
                        {(fieldError(`line-${index}-qty`) ||
                          fieldError(`line-${index}-material`)) && (
                          <p className="text-xs text-destructive">
                            {fieldError(`line-${index}-qty`) ||
                              fieldError(`line-${index}-material`)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {fieldError("lines") && (
                    <p className="mt-1 text-sm text-destructive">{fieldError("lines")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{labels.notes}</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={labels.poNotesPlaceholder}
                  />
                </div>

                <Button onClick={handleCreate} disabled={loading} className="w-full">
                  {loading ? labels.saving : labels.poCreate}
                </Button>
              </CardContent>
            </Card>
          )}

          {selected && !isCreating && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{selected.orderNo}</CardTitle>
                <CardDescription>
                  {selected.supplierName} · {statusLabel(selected.status)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">{labels.poTotal}:</span>{" "}
                    <span className="font-medium">
                      {formatBrlFromCents(selected.totalCents)}
                    </span>
                  </p>
                  {selected.deliveryDate && (
                    <p>
                      <span className="text-muted-foreground">{labels.poExpectedDate}:</span>{" "}
                      {new Date(selected.deliveryDate).toLocaleDateString("tr-TR")}
                    </p>
                  )}
                  {selected.notes && (
                    <p className="text-muted-foreground">{selected.notes}</p>
                  )}
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-2 py-1.5">{labels.colName}</th>
                        <th className="px-2 py-1.5">{labels.quantity}</th>
                        <th className="px-2 py-1.5">{labels.poReceived}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-2 py-1.5">
                            <p className="font-medium">{item.materialName}</p>
                            <p className="text-xs text-muted-foreground">{item.materialCode}</p>
                          </td>
                          <td className="px-2 py-1.5">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-2 py-1.5">
                            {item.receivedQty} / {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {capabilities.canEdit && nextStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={status === "cancelled" ? "outline" : "default"}
                        onClick={() => updateStatus(status)}
                        disabled={loading}
                      >
                        {labels[`poAction_${status}`] ?? statusLabel(status)}
                      </Button>
                    ))}
                  </div>
                )}

                {canReceive && capabilities.canEdit && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <p className="text-sm font-medium">{labels.poReceiveTitle}</p>
                    <p className="text-xs text-muted-foreground">{labels.poReceiveDesc}</p>
                    {selected.items
                      .filter((i) => i.receivedQty < i.quantity)
                      .map((item, index) => {
                        const remaining = item.quantity - item.receivedQty;
                        return (
                          <FormField
                            key={item.id}
                            label={`${item.materialName} (max ${remaining} ${item.unit})`}
                            error={fieldError(`recv-${index}`)}
                          >
                            <Input
                              value={receiveQty[item.id] ?? ""}
                              onChange={(e) => {
                                setReceiveQty((prev) => ({
                                  ...prev,
                                  [item.id]: sanitizeDecimalInput(e.target.value),
                                }));
                                clearFieldError(`recv-${index}`);
                                clearFieldError("receive");
                              }}
                              placeholder="0"
                            />
                          </FormField>
                        );
                      })}
                    {fieldError("receive") && (
                      <p className="text-sm text-destructive">{fieldError("receive")}</p>
                    )}
                    <Button onClick={handleReceive} disabled={loading} className="w-full">
                      {labels.poReceive}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </div>
    </>
  );
}
