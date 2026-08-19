"use client";

import { useCallback, useEffect, useState } from "react";

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
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import {
  validatePriceListHeader,
  validatePriceListItems,
} from "@/lib/forms/orders-validation";
import { sanitizeMoneyInput } from "@/lib/forms/validation";
import type {
  OrdersCapabilities,
  PriceListItemRow,
  PriceListRow,
  ProductOption,
} from "@/lib/pricing/types";
import { parseBrlToCents } from "@/lib/stock/constants";

interface PriceListsSectionProps {
  initialPriceLists: PriceListRow[];
  products: ProductOption[];
  capabilities: OrdersCapabilities;
  labels: Record<string, string>;
}

interface ListForm {
  code: string;
  name: string;
  channel: string;
  region: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

interface ItemLine {
  productId: string;
  boxPrice: string;
  unitPrice: string;
}

function emptyListForm(): ListForm {
  return {
    code: "",
    name: "",
    channel: "retail",
    region: "",
    validFrom: "",
    validTo: "",
    isActive: true,
  };
}

function fromList(list: PriceListRow): ListForm {
  return {
    code: list.code,
    name: list.name,
    channel: list.channel ?? "retail",
    region: list.region ?? "",
    validFrom: list.validFrom ? list.validFrom.slice(0, 10) : "",
    validTo: list.validTo ? list.validTo.slice(0, 10) : "",
    isActive: list.isActive,
  };
}

function itemsToLines(
  items: PriceListItemRow[],
  products: ProductOption[],
): ItemLine[] {
  const byProduct = new Map(items.map((i) => [i.productId, i]));
  return products.map((p) => {
    const item = byProduct.get(p.id);
    return {
      productId: p.id,
      boxPrice: item ? (item.boxPriceCents / 100).toFixed(2) : "",
      unitPrice: item ? (item.unitPriceCents / 100).toFixed(2) : "",
    };
  });
}

export function PriceListsSection({
  initialPriceLists,
  products,
  capabilities,
  labels,
}: PriceListsSectionProps) {
  const [lists, setLists] = useLiveState(initialPriceLists);
  const [selectedId, setSelectedId] = useState(initialPriceLists[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ListForm>(emptyListForm());
  const [lines, setLines] = useState<ItemLine[]>(itemsToLines([], products));
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

  const loadDetail = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/api/orders/price-lists/${id}`);
      const data = await res.json();
      if (!res.ok) return;
      setForm(fromList(data.priceList));
      setLines(itemsToLines(data.items, products));
    },
    [products],
  );

  useEffect(() => {
    if (selectedId && !isCreating) {
      loadDetail(selectedId);
    }
  }, [selectedId, isCreating, loadDetail]);

  function selectList(list: PriceListRow) {
    setSelectedId(list.id);
    setIsCreating(false);
    clearErrors();
    setMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setForm(emptyListForm());
    setLines(itemsToLines([], products));
    clearErrors();
    setMessage("");
  }

  async function handleSaveHeader() {
    if (!applyValidationErrors(validatePriceListHeader(form))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const payload = {
        ...form,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      };
      if (isCreating) {
        const res = await apiFetch("/api/orders/price-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setLists((prev) => [...prev, data.priceList]);
        setSelectedId(data.priceList.id);
        setIsCreating(false);
        setMessage(labels.created);
      } else if (selectedId) {
        const res = await apiFetch(`/api/orders/price-lists/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setLists((prev) =>
          prev.map((l) => (l.id === data.priceList.id ? data.priceList : l)),
        );
        setMessage(labels.saved);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveItems() {
    if (!selectedId) return;
    if (!applyValidationErrors(validatePriceListItems(lines, productSkuMap))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const items = lines
        .filter((l) => l.boxPrice || l.unitPrice)
        .map((l) => ({
          productId: l.productId,
          boxPriceCents: parseBrlToCents(l.boxPrice) ?? 0,
          unitPriceCents: parseBrlToCents(l.unitPrice) ?? 0,
        }));

      const res = await apiFetch(`/api/orders/price-lists/${selectedId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setLines(itemsToLines(data.items, products));
      setLists((prev) =>
        prev.map((l) =>
          l.id === selectedId ? { ...l, itemCount: data.items.length } : l,
        ),
      );
      setMessage(labels.itemsSaved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.priceListsList}</CardTitle>
          <CardDescription>{lists.length} {labels.records}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => selectList(list)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === list.id && !isCreating
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <p className="font-mono text-xs">{list.code}</p>
              <p className="font-medium">{list.name}</p>
              <p className="text-xs text-muted-foreground">
                {list.itemCount} {labels.itemsShort}
              </p>
            </button>
          ))}
          {capabilities.canCreate && (
            <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
              + {labels.newPriceList}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isCreating ? labels.newPriceList : form.name || labels.selectPriceList}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(isCreating || selectedId) && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={labels.code} required error={fieldError("code")}>
                    <Input
                      value={form.code}
                      onChange={(e) => {
                        clearFieldError("code");
                        setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }));
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                      aria-invalid={!!fieldError("code")}
                    />
                  </FormField>
                  <FormField label={labels.name} required error={fieldError("name")}>
                    <Input
                      value={form.name}
                      onChange={(e) => {
                        clearFieldError("name");
                        setForm((f) => ({ ...f, name: e.target.value }));
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                      aria-invalid={!!fieldError("name")}
                    />
                  </FormField>
                  <div className="space-y-2">
                    <Label>{labels.channel}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.channel}
                      onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                      disabled={!capabilities.canEdit && !isCreating}
                    >
                      <option value="retail">{labels.channelRetail}</option>
                      <option value="corporate">{labels.channelCorporate}</option>
                      <option value="portal">{labels.channelPortal}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{labels.region}</Label>
                    <Input
                      value={form.region}
                      onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </div>
                </div>
                {(capabilities.canCreate && isCreating) ||
                (capabilities.canEdit && !isCreating) ? (
                  <Button onClick={handleSaveHeader} disabled={loading}>
                    {loading ? labels.saving : isCreating ? labels.create : labels.save}
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {selectedId && !isCreating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.listItems}</CardTitle>
              <CardDescription>{labels.listItemsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded-lg border max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2">{labels.product}</th>
                      <th className="px-3 py-2">{labels.boxPrice}</th>
                      <th className="px-3 py-2">{labels.unitPrice}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const product = products.find((p) => p.id === line.productId);
                      return (
                        <tr key={line.productId} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs">{product?.sku}</span>
                            <span className="ml-2 text-muted-foreground">
                              {product?.name}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={line.boxPrice}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === index
                                      ? { ...l, boxPrice: sanitizeMoneyInput(e.target.value) }
                                      : l,
                                  ),
                                )
                              }
                              className="h-8 w-28"
                              disabled={!capabilities.canEdit}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={line.unitPrice}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === index
                                      ? { ...l, unitPrice: sanitizeMoneyInput(e.target.value) }
                                      : l,
                                  ),
                                )
                              }
                              className="h-8 w-28"
                              disabled={!capabilities.canEdit}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {capabilities.canEdit && (
                <Button onClick={handleSaveItems} disabled={loading}>
                  {labels.saveItems}
                </Button>
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
