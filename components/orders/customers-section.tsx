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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import {
  validateChannelCodes,
  validateCustomerInfo,
  validateCustomerPrices,
  validateCustomerTiers,
} from "@/lib/forms/orders-validation";
import {
  sanitizeDecimalInput,
  sanitizeIntInput,
  sanitizeMoneyInput,
} from "@/lib/forms/validation";
import { DEFAULT_FREIGHT_TYPE, normalizeFreightType } from "@/lib/orders/constants";
import type {
  ChannelCodeRow,
  CustomerPriceRow,
  CustomerRow,
  OrdersCapabilities,
  PriceListRow,
  PriceTierRow,
  ProductOption,
  SalesRepRow,
} from "@/lib/pricing/types";
import { formatBrlFromCents, parseBrlToCents } from "@/lib/stock/constants";

type DetailTab = "info" | "prices" | "tiers" | "codes" | "tools";

interface CustomersSectionProps {
  initialCustomers: CustomerRow[];
  salesReps: SalesRepRow[];
  priceLists: PriceListRow[];
  products: ProductOption[];
  capabilities: OrdersCapabilities;
  labels: Record<string, string>;
}

interface CustomerForm {
  name: string;
  cnpj: string;
  region: string;
  salesRepId: string;
  priceListId: string;
  paymentTerms: string;
  freightType: string;
  address: string;
  deliveryAddress: string;
  billingAddress: string;
  phone: string;
  email: string;
  contactName: string;
  notes: string;
  isActive: boolean;
}

interface PriceLine {
  productId: string;
  boxPrice: string;
  unitPrice: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

interface TierLine {
  productId: string;
  thresholdQty: string;
  thresholdUnit: string;
  discountPercent: string;
  boxPrice: string;
  unitPrice: string;
  notes: string;
}

interface CodeLine {
  productId: string;
  channel: string;
  externalSku: string;
}

function emptyCustomerForm(): CustomerForm {
  return {
    name: "",
    cnpj: "",
    region: "",
    salesRepId: "",
    priceListId: "",
    paymentTerms: "",
    freightType: DEFAULT_FREIGHT_TYPE,
    address: "",
    deliveryAddress: "",
    billingAddress: "",
    phone: "",
    email: "",
    contactName: "",
    notes: "",
    isActive: true,
  };
}

function fromCustomer(c: CustomerRow): CustomerForm {
  return {
    name: c.name,
    cnpj: c.cnpj ?? "",
    region: c.region ?? "",
    salesRepId: c.salesRepId ?? "",
    priceListId: c.priceListId ?? "",
    paymentTerms: c.paymentTerms ?? "",
    freightType: normalizeFreightType(c.freightType),
    address: c.address ?? "",
    deliveryAddress: c.deliveryAddress ?? "",
    billingAddress: c.billingAddress ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    contactName: c.contactName ?? "",
    notes: c.notes ?? "",
    isActive: c.isActive,
  };
}

function pricesToLines(rows: CustomerPriceRow[]): PriceLine[] {
  return rows.map((r) => ({
    productId: r.productId,
    boxPrice: r.boxPriceCents != null ? (r.boxPriceCents / 100).toFixed(2) : "",
    unitPrice: r.unitPriceCents != null ? (r.unitPriceCents / 100).toFixed(2) : "",
    validFrom: r.validFrom ? r.validFrom.slice(0, 10) : "",
    validTo: r.validTo ? r.validTo.slice(0, 10) : "",
    notes: r.notes ?? "",
  }));
}

function tiersToLines(rows: PriceTierRow[]): TierLine[] {
  return rows.map((r) => ({
    productId: r.productId ?? "",
    thresholdQty: String(r.thresholdQty),
    thresholdUnit: r.thresholdUnit,
    discountPercent: r.discountPercent != null ? String(r.discountPercent) : "",
    boxPrice: r.boxPriceCents != null ? (r.boxPriceCents / 100).toFixed(2) : "",
    unitPrice: r.unitPriceCents != null ? (r.unitPriceCents / 100).toFixed(2) : "",
    notes: r.notes ?? "",
  }));
}

function codesToLines(rows: ChannelCodeRow[]): CodeLine[] {
  return rows.map((r) => ({
    productId: r.productId,
    channel: r.channel,
    externalSku: r.externalSku,
  }));
}

export function CustomersSection({
  initialCustomers,
  salesReps,
  priceLists,
  products,
  capabilities,
  labels,
}: CustomersSectionProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedId, setSelectedId] = useState(initialCustomers[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm());
  const [priceLines, setPriceLines] = useState<PriceLine[]>([]);
  const [tierLines, setTierLines] = useState<TierLine[]>([]);
  const [codeLines, setCodeLines] = useState<CodeLine[]>([]);
  const [search, setSearch] = useState("");

  const [toolSku, setToolSku] = useState("LQ-ACA-250");
  const [toolProductId, setToolProductId] = useState(
    products.find((p) => p.sku === "BD-250-ACA")?.id ?? products[0]?.id ?? "",
  );
  const [toolQty, setToolQty] = useState("100");
  const [toolUnit, setToolUnit] = useState("unit");
  const [toolSkuResult, setToolSkuResult] = useState("");
  const [toolPriceResult, setToolPriceResult] = useState("");

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

  const productSkuMap = new Map(products.map((p) => [p.id, p.sku]));

  const filtered = customers.filter(
    (c) =>
      !search.trim() ||
      c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (c.cnpj?.includes(search.trim()) ?? false),
  );

  async function loadDetail(id: string) {
    const res = await fetch(`/api/orders/customers/${id}`);
    const data = await res.json();
    if (!res.ok) return;
    setForm(fromCustomer(data.customer));
    setPriceLines(pricesToLines(data.customerPrices));
    setTierLines(tiersToLines(data.priceTiers));
    setCodeLines(codesToLines(data.channelCodes));
    setCustomers((prev) =>
      prev.map((c) => (c.id === data.customer.id ? data.customer : c)),
    );
  }

  function selectCustomer(c: CustomerRow) {
    setSelectedId(c.id);
    setIsCreating(false);
    setForm(fromCustomer(c));
    setDetailTab("info");
    clearErrors();
    setMessage("");
    loadDetail(c.id);
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setForm(emptyCustomerForm());
    setPriceLines([]);
    setTierLines([]);
    setCodeLines([]);
    clearErrors();
    setMessage("");
  }

  async function handleSaveInfo() {
    if (!applyValidationErrors(validateCustomerInfo(form))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    const payload = {
      ...form,
      salesRepId: form.salesRepId || null,
      priceListId: form.priceListId || null,
    };
    try {
      if (isCreating) {
        const res = await fetch("/api/orders/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setCustomers((prev) => [...prev, data.customer]);
        selectCustomer(data.customer);
        setMessage(labels.created);
      } else if (selectedId) {
        const res = await fetch(`/api/orders/customers/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setCustomers((prev) =>
          prev.map((c) => (c.id === data.customer.id ? data.customer : c)),
        );
        setForm(fromCustomer(data.customer));
        setMessage(labels.saved);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePrices() {
    if (!selectedId) return;
    if (!applyValidationErrors(validateCustomerPrices(priceLines, productSkuMap))) return;

    setLoading(true);
    clearErrors();
    try {
      const items = priceLines.map((l) => ({
        productId: l.productId,
        boxPriceCents: parseBrlToCents(l.boxPrice),
        unitPriceCents: parseBrlToCents(l.unitPrice),
        validFrom: l.validFrom || null,
        validTo: l.validTo || null,
        notes: l.notes.trim() || null,
      }));
      const res = await fetch(`/api/orders/customers/${selectedId}/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
          showApiError(data, labels.saveError);
        return;
      }
      setPriceLines(pricesToLines(data.customerPrices));
      setMessage(labels.pricesSaved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTiers() {
    if (!selectedId) return;
    if (!applyValidationErrors(validateCustomerTiers(tierLines))) return;

    setLoading(true);
    clearErrors();
    try {
      const items = tierLines.map((l) => ({
        productId: l.productId || null,
        thresholdQty: Number(l.thresholdQty),
        thresholdUnit: l.thresholdUnit,
        discountPercent: l.discountPercent ? Number(l.discountPercent) : null,
        boxPriceCents: parseBrlToCents(l.boxPrice),
        unitPriceCents: parseBrlToCents(l.unitPrice),
        notes: l.notes.trim() || null,
      }));
      const res = await fetch(`/api/orders/customers/${selectedId}/tiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
          showApiError(data, labels.saveError);
        return;
      }
      setTierLines(tiersToLines(data.priceTiers));
      setMessage(labels.tiersSaved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCodes() {
    if (!selectedId) return;
    if (!applyValidationErrors(validateChannelCodes(codeLines))) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await fetch(`/api/orders/customers/${selectedId}/channel-codes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: codeLines }),
      });
      const data = await res.json();
      if (!res.ok) {
          showApiError(data, labels.saveError);
        return;
      }
      setCodeLines(codesToLines(data.channelCodes));
      setMessage(labels.codesSaved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function runSkuResolve() {
    if (!selectedId) return;
    setToolSkuResult("");
    const res = await fetch(
      `/api/orders/resolve-sku?externalSku=${encodeURIComponent(toolSku)}&customerId=${selectedId}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setToolSkuResult(data.error || labels.skuNotFound);
      return;
    }
    setToolSkuResult(
      `${data.resolution.externalSku} → ${data.resolution.internalSku} (${data.resolution.productName}) [${data.resolution.matchType}]`,
    );
  }

  async function runPriceResolve() {
    if (!selectedId || !toolProductId) return;
    setToolPriceResult("");
    const res = await fetch("/api/orders/resolve-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedId,
        productId: toolProductId,
        quantity: Number(toolQty),
        quantityUnit: toolUnit,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setToolPriceResult(data.error || labels.priceNotFound);
      return;
    }
    const p = data.price;
    setToolPriceResult(
      `${data.sourceLabel}: koli ${formatBrlFromCents(p.boxPriceCents ?? 0)} · kutu ${formatBrlFromCents(p.unitPriceCents ?? 0)}${p.sourceDetail ? ` (${p.sourceDetail})` : ""}`,
    );
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.customersList}</CardTitle>
          <CardDescription>{filtered.length} {labels.records}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCustomer(c)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === c.id && !isCreating
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <p className="font-medium leading-tight">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.priceListName ?? "—"} · {c.salesRepName ?? "—"}
              </p>
            </button>
          ))}
          {capabilities.canCreate && (
            <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
              + {labels.newCustomer}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(isCreating || selectedId) && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "info" as DetailTab, label: labels.tabInfo },
                { id: "prices" as DetailTab, label: labels.tabPrices },
                { id: "tiers" as DetailTab, label: labels.tabTiers },
                { id: "codes" as DetailTab, label: labels.tabCodes },
                { id: "tools" as DetailTab, label: labels.tabTools },
              ] as const
            ).map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={detailTab === t.id ? "default" : "outline"}
                onClick={() => setDetailTab(t.id)}
                disabled={isCreating && t.id !== "info"}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}

        {detailTab === "info" && (isCreating || selectedId) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isCreating ? labels.newCustomer : form.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={labels.name} error={fieldError("name")} required>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name: e.target.value }));
                      clearFieldError("name");
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </FormField>
                <div className="space-y-2">
                  <Label>{labels.cnpj}</Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{labels.region}</Label>
                  <Input
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{labels.salesRep}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.salesRepId}
                    onChange={(e) => setForm((f) => ({ ...f, salesRepId: e.target.value }))}
                    disabled={!capabilities.canEdit && !isCreating}
                  >
                    <option value="">{labels.noSalesRep}</option>
                    {salesReps.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{labels.priceList}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.priceListId}
                    onChange={(e) => setForm((f) => ({ ...f, priceListId: e.target.value }))}
                    disabled={!capabilities.canEdit && !isCreating}
                  >
                    <option value="">{labels.noPriceList}</option>
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{labels.paymentTerms}</Label>
                  <Input
                    value={form.paymentTerms}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                    }
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{labels.address}</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </div>
              </div>
              {(capabilities.canCreate && isCreating) ||
              (capabilities.canEdit && !isCreating) ? (
                <Button onClick={handleSaveInfo} disabled={loading}>
                  {loading ? labels.saving : isCreating ? labels.create : labels.save}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        {detailTab === "prices" && selectedId && !isCreating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.tabPrices}</CardTitle>
              <CardDescription>{labels.tabPricesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPriceLines((p) => [
                    ...p,
                    {
                      productId: products[0]?.id ?? "",
                      boxPrice: "",
                      unitPrice: "",
                      validFrom: "",
                      validTo: "",
                      notes: "",
                    },
                  ])
                }
                disabled={!capabilities.canEdit}
              >
                + {labels.addLine}
              </Button>
              {priceLines.map((line, index) => (
                <div key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-6">
                  <select
                    className="rounded-md border px-2 py-1 text-sm sm:col-span-2"
                    value={line.productId}
                    onChange={(e) =>
                      setPriceLines((p) =>
                        p.map((l, i) =>
                          i === index ? { ...l, productId: e.target.value } : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku}</option>
                    ))}
                  </select>
                  <Input
                    placeholder={labels.boxPrice}
                    value={line.boxPrice}
                    onChange={(e) =>
                      setPriceLines((p) =>
                        p.map((l, i) =>
                          i === index
                            ? { ...l, boxPrice: sanitizeMoneyInput(e.target.value) }
                            : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  />
                  <Input
                    placeholder={labels.unitPrice}
                    value={line.unitPrice}
                    onChange={(e) =>
                      setPriceLines((p) =>
                        p.map((l, i) =>
                          i === index
                            ? { ...l, unitPrice: sanitizeMoneyInput(e.target.value) }
                            : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPriceLines((p) => p.filter((_, i) => i !== index))}
                    disabled={!capabilities.canEdit}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {capabilities.canEdit && (
                <Button onClick={handleSavePrices} disabled={loading}>
                  {labels.savePrices}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {detailTab === "tiers" && selectedId && !isCreating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.tabTiers}</CardTitle>
              <CardDescription>{labels.tabTiersDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setTierLines((p) => [
                    ...p,
                    {
                      productId: "",
                      thresholdQty: "100",
                      thresholdUnit: "unit",
                      discountPercent: "5",
                      boxPrice: "",
                      unitPrice: "",
                      notes: "",
                    },
                  ])
                }
                disabled={!capabilities.canEdit}
              >
                + {labels.addTier}
              </Button>
              {tierLines.map((line, index) => (
                <div key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-4">
                  <Input
                    placeholder={labels.thresholdQty}
                    value={line.thresholdQty}
                    onChange={(e) =>
                      setTierLines((p) =>
                        p.map((l, i) =>
                          i === index
                            ? { ...l, thresholdQty: sanitizeIntInput(e.target.value) }
                            : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  />
                  <select
                    className="rounded-md border px-2 py-1 text-sm"
                    value={line.thresholdUnit}
                    onChange={(e) =>
                      setTierLines((p) =>
                        p.map((l, i) =>
                          i === index ? { ...l, thresholdUnit: e.target.value } : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  >
                    <option value="box">{labels.unitBox}</option>
                    <option value="unit">{labels.unitPiece}</option>
                  </select>
                  <Input
                    placeholder={labels.discountPercent}
                    value={line.discountPercent}
                    onChange={(e) =>
                      setTierLines((p) =>
                        p.map((l, i) =>
                          i === index
                            ? { ...l, discountPercent: sanitizeDecimalInput(e.target.value) }
                            : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTierLines((p) => p.filter((_, i) => i !== index))}
                    disabled={!capabilities.canEdit}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {capabilities.canEdit && (
                <Button onClick={handleSaveTiers} disabled={loading}>
                  {labels.saveTiers}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {detailTab === "codes" && selectedId && !isCreating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.tabCodes}</CardTitle>
              <CardDescription>{labels.tabCodesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCodeLines((p) => [
                    ...p,
                    {
                      productId: products.find((x) => x.sku === "BD-250-ACA")?.id ?? "",
                      channel: "portal",
                      externalSku: "LQ-ACA-250",
                    },
                  ])
                }
                disabled={!capabilities.canEdit}
              >
                + {labels.addCode}
              </Button>
              {codeLines.map((line, index) => (
                <div key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-4">
                  <select
                    className="rounded-md border px-2 py-1 text-sm"
                    value={line.productId}
                    onChange={(e) =>
                      setCodeLines((p) =>
                        p.map((l, i) =>
                          i === index ? { ...l, productId: e.target.value } : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku}</option>
                    ))}
                  </select>
                  <Input
                    placeholder={labels.externalSku}
                    value={line.externalSku}
                    onChange={(e) =>
                      setCodeLines((p) =>
                        p.map((l, i) =>
                          i === index
                            ? { ...l, externalSku: e.target.value.toUpperCase() }
                            : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  />
                  <select
                    className="rounded-md border px-2 py-1 text-sm"
                    value={line.channel}
                    onChange={(e) =>
                      setCodeLines((p) =>
                        p.map((l, i) =>
                          i === index ? { ...l, channel: e.target.value } : l,
                        ),
                      )
                    }
                    disabled={!capabilities.canEdit}
                  >
                    <option value="corporate">{labels.channelCorporate}</option>
                    <option value="portal">{labels.channelPortal}</option>
                    <option value="retail">{labels.channelRetail}</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCodeLines((p) => p.filter((_, i) => i !== index))}
                    disabled={!capabilities.canEdit}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {capabilities.canEdit && (
                <Button onClick={handleSaveCodes} disabled={loading}>
                  {labels.saveCodes}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {detailTab === "tools" && selectedId && !isCreating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.tabTools}</CardTitle>
              <CardDescription>{labels.tabToolsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <Label>{labels.skuResolve}</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={toolSku}
                    onChange={(e) => setToolSku(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button size="sm" onClick={runSkuResolve}>{labels.resolve}</Button>
                </div>
                {toolSkuResult && (
                  <p className="text-sm">
                    <Badge variant="secondary">{toolSkuResult}</Badge>
                  </p>
                )}
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <Label>{labels.priceResolve}</Label>
                <div className="flex flex-wrap gap-2 items-end">
                  <select
                    className="rounded-md border px-2 py-2 text-sm"
                    value={toolProductId}
                    onChange={(e) => setToolProductId(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku}</option>
                    ))}
                  </select>
                  <Input
                    value={toolQty}
                    onChange={(e) => setToolQty(e.target.value)}
                    className="w-24"
                  />
                  <select
                    className="rounded-md border px-2 py-2 text-sm"
                    value={toolUnit}
                    onChange={(e) => setToolUnit(e.target.value)}
                  >
                    <option value="unit">{labels.unitPiece}</option>
                    <option value="box">{labels.unitBox}</option>
                  </select>
                  <Button size="sm" onClick={runPriceResolve}>{labels.resolve}</Button>
                </div>
                {toolPriceResult && (
                  <p className="text-sm font-medium">{toolPriceResult}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
    </>
  );
}
