"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, Factory, FileUp, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KanbanColumn } from "@/components/ui/kanban-column";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatCard } from "@/components/ui/stat-card";
import { WorkflowStrip } from "@/components/ui/workflow-strip";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateOrderForm } from "@/lib/forms/orders-validation";
import {
  sanitizeDecimalInput,
  sanitizeIntInput,
  sanitizeMoneyInput,
} from "@/lib/forms/validation";
import {
  DEFAULT_FREIGHT_TYPE,
  FREIGHT_TYPES,
  KANBAN_STATUSES,
  normalizeFreightType,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/orders/constants";
import { OrderProductionAnalysisPanel } from "@/components/orders/order-production-analysis";
import { AuditHistoryPanel } from "@/components/audit/audit-history-panel";
import { computeOrderTotals } from "@/lib/orders/compute";
import type {
  OrderProductOption,
  OrdersCapabilities,
  OrderRow,
} from "@/lib/orders/types";
import type { CustomerRow } from "@/lib/pricing/types";
import {
  formatBrlFromCents,
  parseBrlToCents,
} from "@/lib/stock/constants";

interface LineState {
  productId: string;
  quantityBoxes: string;
  quantityUnits: string;
  unitPrice: string;
  boxPrice: string;
  discountPercent: string;
  totalCents: number;
  marginPercent: number | null;
  listUnitPriceCents: number | null;
  unitsPerBox: number;
}

interface OrdersSectionProps {
  initialOrders: OrderRow[];
  customers: CustomerRow[];
  products: OrderProductOption[];
  capabilities: OrdersCapabilities;
  labels: Record<string, string>;
}

const KANBAN_ACCENT: Record<OrderStatus, string> = {
  draft: "bg-slate-400",
  pending_approval: "bg-amber-500",
  approved: "bg-blue-500",
  in_production: "bg-violet-500",
  ready_ship: "bg-emerald-500",
  shipped: "bg-green-600",
  cancelled: "bg-red-400",
};

function orderWorkflowStep(
  status: OrderStatus,
  step: "draft" | "approval" | "production" | "ship",
): "complete" | "current" | "upcoming" {
  const flow: Record<typeof step, OrderStatus[]> = {
    draft: ["draft"],
    approval: ["pending_approval", "approved"],
    production: ["in_production"],
    ship: ["ready_ship", "shipped"],
  };
  const order = ["draft", "approval", "production", "ship"] as const;
  const statusStep = order.find((s) => flow[s].includes(status)) ?? "draft";
  const currentIdx = order.indexOf(statusStep);
  const stepIdx = order.indexOf(step);
  if (stepIdx < currentIdx) return "complete";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

function emptyLine(products: OrderProductOption[]): LineState {
  const p = products[0];
  return {
    productId: p?.id ?? "",
    quantityBoxes: "1",
    quantityUnits: String(p?.unitsPerBox ?? 0),
    unitPrice: "",
    boxPrice: "",
    discountPercent: "0",
    totalCents: 0,
    marginPercent: null,
    listUnitPriceCents: null,
    unitsPerBox: p?.unitsPerBox ?? 0,
  };
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function OrdersSection({
  initialOrders,
  customers,
  products,
  capabilities,
  labels,
}: OrdersSectionProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [view, setView] = useState<"kanban" | "editor">("kanban");
  const [selectedId, setSelectedId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [orderNo, setOrderNo] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [channel, setChannel] = useState("retail_form");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [freightType, setFreightType] = useState<string>(DEFAULT_FREIGHT_TYPE);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [freightInput, setFreightInput] = useState("0");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("draft");
  const [lines, setLines] = useState<LineState[]>([emptyLine(products)]);

  const [editorTab, setEditorTab] = useState<"form" | "analysis" | "history">("form");
  const [loading, setLoading] = useState(false);
  const [importPdfLoading, setImportPdfLoading] = useState(false);
  const importPdfRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const {
    fieldError,
    clearErrors,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const inputMode = channel === "proposal" || channel === "portal" ? "unit" : "box";

  const kanbanStats = useMemo(() => {
    const active = orders.filter((o) => o.status !== "cancelled");
    const pending = orders.filter((o) => o.status === "pending_approval").length;
    const inProduction = orders.filter((o) => o.status === "in_production").length;
    const pipelineValue = active
      .filter((o) =>
        ["pending_approval", "approved", "in_production", "ready_ship"].includes(o.status),
      )
      .reduce((sum, o) => sum + o.totalCents, 0);
    return { total: active.length, pending, inProduction, pipelineValue };
  }, [orders]);

  const filteredProducts = useMemo(() => {
    if (!customerId) return products;
    return products.filter((p) => !p.customerId || p.customerId === customerId);
  }, [products, customerId]);

  const previewLine = useCallback(
    async (index: number, line: LineState) => {
      if (!customerId || !line.productId) return;
      const res = await fetch("/api/orders/preview-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          productId: line.productId,
          channel,
          quantityBoxes: Number(line.quantityBoxes) || 0,
          quantityUnits: Number(line.quantityUnits) || 0,
          discountPercent: Number(line.discountPercent) || 0,
          unitPriceCents:
            line.unitPrice && capabilities.canSetPrice
              ? parseBrlToCents(line.unitPrice)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setLines((prev) =>
        prev.map((l, i) => {
          if (i !== index) return l;
          return {
            ...l,
            quantityBoxes: String(data.quantityBoxes),
            quantityUnits: String(data.quantityUnits),
            unitsPerBox: data.unitsPerBox,
            unitPrice: capabilities.canSetPrice && l.unitPrice
              ? l.unitPrice
              : centsToInput(data.unitPriceCents),
            boxPrice: centsToInput(data.boxPriceCents),
            totalCents: data.totalCents,
            marginPercent: data.marginPercent,
            listUnitPriceCents: data.listUnitPriceCents,
          };
        }),
      );
    },
    [customerId, channel, capabilities.canSetPrice],
  );

  // Müşteri veya kanal değiştiğinde tüm satırlar yeniden fiyatlandırılır.
  // `lines` bağımlılığa eklenemez: previewLine satırları güncellediği için
  // efekt kendini sonsuz döngüde tetiklerdi.
  useEffect(() => {
    if (view !== "editor") return;
    lines.forEach((line, index) => {
      if (line.productId) previewLine(index, line);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, channel]);

  async function loadOrder(id: string) {
    const res = await fetch(`/api/orders/sales/${id}`);
    const data = await res.json();
    if (!res.ok) return;
    const o = data.order;
    setOrderNo(o.orderNo);
    setCustomerId(o.customerId);
    setChannel(o.channel ?? "retail_form");
    setPaymentTerms(o.paymentTerms ?? "");
    setFreightType(normalizeFreightType(o.freightType));
    setDeliveryDate(o.deliveryDate ? o.deliveryDate.slice(0, 10) : "");
    setDiscountInput(centsToInput(o.discountCents));
    setFreightInput(centsToInput(o.freightCents));
    setNotes(o.notes ?? "");
    setStatus(o.status as OrderStatus);
    setLines(
      o.items.map((item: {
        productId: string;
        quantityBoxes: number;
        quantityUnits: number;
        unitPriceCents: number;
        boxPriceCents: number;
        discountPercent: number;
        totalCents: number;
        marginPercent: number | null;
        listUnitPriceCents: number | null;
        unitsPerBox: number;
      }) => ({
        productId: item.productId,
        quantityBoxes: String(item.quantityBoxes),
        quantityUnits: String(item.quantityUnits),
        unitPrice: centsToInput(item.unitPriceCents),
        boxPrice: centsToInput(item.boxPriceCents),
        discountPercent: String(item.discountPercent),
        totalCents: item.totalCents,
        marginPercent: item.marginPercent,
        listUnitPriceCents: item.listUnitPriceCents,
        unitsPerBox: item.unitsPerBox,
      })),
    );
  }

  function openEditor(order?: OrderRow) {
    setView("editor");
    setEditorTab("form");
    clearErrors();
    setMessage("");
    if (order) {
      setSelectedId(order.id);
      setIsCreating(false);
      loadOrder(order.id);
    } else {
      setIsCreating(true);
      setSelectedId("");
      setOrderNo("");
      setCustomerId(customers[0]?.id ?? "");
      setChannel("retail_form");
      setPaymentTerms(customers[0]?.paymentTerms ?? "");
      setFreightType(DEFAULT_FREIGHT_TYPE);
      setDeliveryDate("");
      setDiscountInput("0");
      setFreightInput("0");
      setNotes("");
      setStatus("draft");
      setLines([emptyLine(filteredProducts)]);
    }
  }

  function backToKanban() {
    setView("kanban");
    setSelectedId("");
    setIsCreating(false);
  }

  async function importPdfFile(file: File) {
    if (!capabilities.canCreate) return;

    if (view !== "editor") {
      openEditor();
    }

    setImportPdfLoading(true);
    clearErrors();
    setMessage("");
    setEditorTab("form");

    try {
      const form = new FormData();
      form.append("file", file);
      if (customerId) form.append("customerId", customerId);
      if (channel) form.append("channel", channel);

      const res = await fetch("/api/orders/import-parse", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || labels.importFromPdfError);
        return;
      }

      const fd = data.formDraft;
      if (fd.customerId) setCustomerId(fd.customerId);
      setChannel(fd.channel);
      setPaymentTerms(fd.paymentTerms);
      setFreightType(fd.freightType);
      setDeliveryDate(fd.deliveryDate);
      setFreightInput(fd.freightInput);
      setNotes(fd.notes);
      if (fd.orderNo) setOrderNo(fd.orderNo);
      if (fd.lines.length > 0) setLines(fd.lines);

      const warnings = (fd.warnings as string[] | undefined)?.filter(Boolean) ?? [];
      setMessage(
        warnings.length > 0
          ? `${labels.importFromPdfSuccess} (${warnings.join(" · ")})`
          : labels.importFromPdfSuccess,
      );
    } catch {
      showError(labels.connectionError);
    } finally {
      setImportPdfLoading(false);
    }
  }

  function handlePdfInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importPdfFile(file);
  }

  const discountCents = parseBrlToCents(discountInput) ?? 0;
  const freightCents = parseBrlToCents(freightInput) ?? 0;
  const { subtotalCents, totalCents } = computeOrderTotals(
    lines.map((l) => ({ totalCents: l.totalCents })),
    discountCents,
    freightCents,
  );

  async function handleSave(targetStatus?: OrderStatus) {
    if (
      !applyValidationErrors(
        validateOrderForm({
          customerId,
          customerLabel: labels.customer,
          inputMode,
          lines,
          discountInput,
          freightInput,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");
    const payload = {
      orderNo: orderNo.trim() || undefined,
      customerId,
      channel,
      paymentTerms,
      freightType,
      deliveryDate: deliveryDate || null,
      discountCents,
      freightCents,
      notes,
      status: targetStatus ?? status,
      items: lines.map((l) => ({
        productId: l.productId,
        quantityBoxes: Number(l.quantityBoxes) || 0,
        quantityUnits: Number(l.quantityUnits) || 0,
        unitPriceCents: parseBrlToCents(l.unitPrice) ?? 0,
        boxPriceCents: parseBrlToCents(l.boxPrice) ?? 0,
        discountPercent: Number(l.discountPercent) || 0,
      })),
    };

    try {
      if (isCreating) {
        const res = await fetch("/api/orders/sales", {
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
        setIsCreating(false);
        setSelectedId(data.order.id);
        setMessage(labels.created);
      } else if (selectedId) {
        const res = await fetch(`/api/orders/sales/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === data.order.id ? { ...o, ...data.order } : o)),
        );
        setStatus(data.order.status as OrderStatus);
        setMessage(labels.saved);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartJob() {
    if (!selectedId) return;
    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await fetch("/api/production/orders/from-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.createOrdersError);
        return;
      }
      const nextStatus =
        (data.orderStatus as OrderStatus | undefined) ??
        ((data.count ?? data.orders?.length ?? 0) > 0
          ? "in_production"
          : "ready_ship");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedId ? { ...o, status: nextStatus } : o,
        ),
      );
      setStatus(nextStatus);
      setMessage(
        data.stockOnly
          ? labels.stockOnlyJobStarted
          : `${labels.ordersCreated} (${data.count ?? data.orders?.length ?? 0})`,
      );
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!selectedId) return;
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch(`/api/orders/sales/${selectedId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.statusError);
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === data.order.id
            ? { ...o, status: data.order.status, totalCents: data.order.totalCents }
            : o,
        ),
      );
      setStatus(data.order.status as OrderStatus);
      setMessage(labels.statusUpdated);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const p = products.find((x) => x.id === patch.productId);
          if (p) {
            next.unitsPerBox = p.unitsPerBox;
            next.quantityUnits = String(
              Math.round(Number(next.quantityBoxes) * p.unitsPerBox),
            );
          }
        }
        return next;
      }),
    );
  }

  if (view === "editor") {
    const editable =
      isCreating || status === "draft" || status === "pending_approval";
    const showAnalysis =
      !isCreating &&
      selectedId &&
      (status === "approved" ||
        status === "in_production" ||
        status === "ready_ship");

    const editorTabs = [
      { id: "form", label: labels.orderFormTab },
      ...(showAnalysis ? [{ id: "analysis", label: labels.analysisTab }] : []),
      ...(!isCreating && selectedId
        ? [{ id: "history", label: labels.historyTab }]
        : []),
    ];

    return (
      <>
        {ErrorModal}
        <input
          ref={importPdfRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={handlePdfInputChange}
        />
        <div className="space-y-5">
          <div className="sticky top-0 z-10 -mx-1 space-y-4 rounded-xl border bg-background/95 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={backToKanban}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
                  {labels.backToKanban}
                </Button>
                {capabilities.canCreate && (isCreating || status === "draft") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={importPdfLoading}
                    onClick={() => importPdfRef.current?.click()}
                    title={labels.importFromPdfHint}
                  >
                    <FileUp className="mr-1.5 h-4 w-4" aria-hidden />
                    {importPdfLoading ? labels.importingPdf : labels.importFromPdf}
                  </Button>
                )}
                <div>
                  <p className="font-mono text-lg font-semibold leading-tight">
                    {isCreating ? labels.newOrder : orderNo}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-sm">
                {STATUS_LABELS[status]}
              </Badge>
            </div>

            <WorkflowStrip
              compact
              steps={[
                {
                  id: "draft",
                  label: labels.workflowDraft,
                  status: orderWorkflowStep(status, "draft"),
                },
                {
                  id: "approval",
                  label: labels.workflowApproval,
                  status: orderWorkflowStep(status, "approval"),
                },
                {
                  id: "production",
                  label: labels.workflowProduction,
                  status: orderWorkflowStep(status, "production"),
                },
                {
                  id: "ship",
                  label: labels.workflowShip,
                  status: orderWorkflowStep(status, "ship"),
                },
              ]}
            />

            {editorTabs.length > 1 && (
              <SegmentedControl
                options={editorTabs}
                value={editorTab}
                onChange={(id) =>
                  setEditorTab(id as "form" | "analysis" | "history")
                }
              />
            )}
          </div>

        {editorTab === "history" && selectedId && (
          <AuditHistoryPanel
            entityType="order"
            entityId={selectedId}
            labels={labels}
          />
        )}

        {message && editorTab !== "form" && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        )}

        {editorTab === "analysis" && showAnalysis && selectedId && (
          <OrderProductionAnalysisPanel
            orderId={selectedId}
            canStart={capabilities.canApproveOrder && status === "approved"}
            onStartJob={
              capabilities.canApproveOrder && status === "approved"
                ? () => handleStartJob()
                : undefined
            }
            labels={labels}
          />
        )}

        {editorTab === "form" && (
        <div className="space-y-4">
        <Card>
          <CardHeader className="border-b bg-muted/20 py-3">
            <CardTitle className="text-base">{labels.sectionCustomer}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>{labels.orderNo}</Label>
                <Input
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  disabled={!isCreating}
                  placeholder={labels.orderNoAuto}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.customer}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers.find((x) => x.id === e.target.value);
                    if (c?.paymentTerms) setPaymentTerms(c.paymentTerms);
                  }}
                  disabled={!editable}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{labels.channel}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  disabled={!editable}
                >
                  <option value="retail_form">{labels.channelRetail}</option>
                  <option value="proposal">{labels.channelCorporate}</option>
                  <option value="portal">{labels.channelPortal}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{labels.paymentTerms}</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.freightType}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={freightType}
                  onChange={(e) => setFreightType(e.target.value)}
                  disabled={!editable}
                >
                  {FREIGHT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{labels.deliveryDate}</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  disabled={!editable}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{labels.notes}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!editable}
                placeholder="—"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/20 py-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{labels.sectionLines}</CardTitle>
              {editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLines((p) => [...p, emptyLine(filteredProducts)])
                  }
                >
                  + {labels.addLine}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-2">{labels.product}</th>
                      <th className="px-3 py-2">
                        {inputMode === "box" ? labels.quantityBoxes : labels.quantityUnits}
                      </th>
                      <th className="px-3 py-2">{labels.unitPrice}</th>
                      <th className="px-3 py-2">{labels.boxPrice}</th>
                      <th className="px-3 py-2">{labels.discountPercent}</th>
                      <th className="px-3 py-2">{labels.lineTotal}</th>
                      <th className="px-3 py-2">{labels.margin}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <select
                            className="w-full min-w-[140px] rounded-md border px-2 py-1 text-sm"
                            value={line.productId}
                            onChange={(e) => {
                              updateLine(index, { productId: e.target.value });
                              setTimeout(() => previewLine(index, {
                                ...line,
                                productId: e.target.value,
                              }), 0);
                            }}
                            disabled={!editable}
                          >
                            {filteredProducts.map((p) => (
                              <option key={p.id} value={p.id}>{p.sku}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {inputMode === "box" ? (
                            <Input
                              className="h-8 w-20"
                              value={line.quantityBoxes}
                              inputMode="numeric"
                              onChange={(e) => {
                                updateLine(index, {
                                  quantityBoxes: sanitizeIntInput(e.target.value),
                                });
                              }}
                              onBlur={() => previewLine(index, lines[index])}
                              disabled={!editable}
                            />
                          ) : (
                            <Input
                              className="h-8 w-20"
                              value={line.quantityUnits}
                              inputMode="numeric"
                              onChange={(e) => {
                                updateLine(index, {
                                  quantityUnits: sanitizeIntInput(e.target.value),
                                });
                              }}
                              onBlur={() => previewLine(index, lines[index])}
                              disabled={!editable}
                            />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {line.quantityUnits} {labels.unitPieceShort}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-8 w-24"
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(index, { unitPrice: e.target.value })
                            }
                            onBlur={() => previewLine(index, lines[index])}
                            disabled={!editable || !capabilities.canSetPrice}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {line.boxPrice}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-8 w-16"
                            value={line.discountPercent}
                            inputMode="decimal"
                            onChange={(e) =>
                              updateLine(index, {
                                discountPercent: sanitizeDecimalInput(e.target.value),
                              })
                            }
                            onBlur={() => previewLine(index, lines[index])}
                            disabled={!editable}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {formatBrlFromCents(line.totalCents)}
                        </td>
                        <td className="px-3 py-2">
                          {line.marginPercent != null ? (
                            <span
                              className={
                                line.marginPercent < 10
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }
                            >
                              {line.marginPercent.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editable && lines.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setLines((p) => p.filter((_, i) => i !== index))
                              }
                            >
                              ×
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/20 py-3">
            <CardTitle className="text-base">{labels.sectionTotals}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{labels.orderDiscount}</Label>
                <Input
                  value={discountInput}
                  inputMode="decimal"
                  onChange={(e) => setDiscountInput(sanitizeMoneyInput(e.target.value))}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-2">
                <Label>{labels.freightAmount}</Label>
                <Input
                  value={freightInput}
                  inputMode="decimal"
                  onChange={(e) => setFreightInput(sanitizeMoneyInput(e.target.value))}
                  disabled={!editable}
                />
              </div>
              <div className="rounded-lg border bg-primary/5 p-4 text-sm">
                <div className="text-muted-foreground">{labels.subtotal}</div>
                <div className="text-muted-foreground mt-2">{labels.orderTotal}</div>
                <div className="font-semibold text-2xl mt-1 tabular-nums">
                  {formatBrlFromCents(totalCents)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {labels.subtotal}: {formatBrlFromCents(subtotalCents)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {editable && capabilities.canCreate && (
                <Button onClick={() => handleSave("draft")} disabled={loading}>
                  {labels.saveDraft}
                </Button>
              )}
              {editable && (
                <Button
                  variant="secondary"
                  onClick={() => handleSave("pending_approval")}
                  disabled={loading}
                >
                  {labels.submitApproval}
                </Button>
              )}
              {status === "pending_approval" &&
                capabilities.canApproveOrder && (
                  <Button onClick={() => handleStatusChange("approved")} disabled={loading}>
                    {labels.approveOrder}
                  </Button>
                )}
            </div>

            {message && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {message}
              </p>
            )}
          </CardContent>
        </Card>
        </div>
        )}
      </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <input
        ref={importPdfRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={handlePdfInputChange}
      />
      <div className="flex flex-wrap items-stretch justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={labels.statTotal}
            value={kanbanStats.total}
            icon={ClipboardList}
            accentClass="bg-slate-500/10 text-slate-600"
          />
          <StatCard
            label={labels.statPending}
            value={kanbanStats.pending}
            icon={Factory}
            accentClass="bg-amber-500/10 text-amber-600"
          />
          <StatCard
            label={labels.statInProduction}
            value={kanbanStats.inProduction}
            icon={Package}
            accentClass="bg-violet-500/10 text-violet-600"
          />
          <StatCard
            label={labels.statPipelineValue}
            value={formatBrlFromCents(kanbanStats.pipelineValue)}
            accentClass="bg-emerald-500/10 text-emerald-600"
          />
        </div>
        {capabilities.canCreate && (
          <div className="flex shrink-0 flex-wrap gap-2 self-center">
            <Button
              variant="outline"
              className="shrink-0"
              disabled={importPdfLoading}
              onClick={() => importPdfRef.current?.click()}
            >
              <FileUp className="mr-1.5 h-4 w-4" aria-hidden />
              {importPdfLoading ? labels.importingPdf : labels.importFromPdf}
            </Button>
            <Button className="shrink-0" onClick={() => openEditor()}>
              + {labels.newOrder}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {KANBAN_STATUSES.map((colStatus) => {
          const colOrders = orders.filter((o) => o.status === colStatus);
          return (
            <KanbanColumn
              key={colStatus}
              title={STATUS_LABELS[colStatus]}
              count={colOrders.length}
              accentClass={KANBAN_ACCENT[colStatus]}
            >
              {colOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => openEditor(order)}
                  className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <p className="font-mono text-sm font-semibold">{order.orderNo}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {order.customerName}
                  </p>
                  {order.lineSummaries.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {order.lineSummaries.slice(0, 2).map((line, index) => (
                        <p
                          key={`${line.productSku}-${index}`}
                          className="truncate text-xs"
                        >
                          <span className="font-mono font-medium">{line.productSku}</span>
                          <span className="text-muted-foreground">
                            {" · "}
                            {line.quantityBoxes > 0
                              ? `${line.quantityBoxes} ${labels.unitBoxShort}`
                              : `${line.quantityUnits} ${labels.unitPieceShort}`}
                          </span>
                        </p>
                      ))}
                      {order.lineSummaries.length > 2 && (
                        <p className="text-[10px] text-muted-foreground">
                          +{order.lineSummaries.length - 2} {labels.itemsShort}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="font-semibold tabular-nums">
                      {formatBrlFromCents(order.totalCents)}
                    </p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {order.itemCount} {labels.itemsShort}
                    </span>
                  </div>
                  {order.deliveryDate && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {labels.deliveryDate}: {order.deliveryDate.slice(0, 10)}
                    </p>
                  )}
                </button>
              ))}
            </KanbanColumn>
          );
        })}
      </div>
    </div>
  );
}
