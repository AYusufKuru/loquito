"use client";

import { useMemo, useState } from "react";

import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";

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
import { validateMaterialForm } from "@/lib/forms/stock-validation";
import {
  sanitizeDecimalInput,
  sanitizeMoneyInput,
} from "@/lib/forms/validation";
import {
  formatBrlFromCents,
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  PACKAGING_SUBCATEGORIES,
  parseBrlToCents,
  RAW_SUBCATEGORIES,
  type MaterialCategory,
} from "@/lib/stock/constants";
import type {
  FlavorOption,
  MaterialRow,
  PackagingOption,
  StockCapabilities,
  SupplierOption,
} from "@/lib/stock/types";

interface MaterialFormState {
  code: string;
  name: string;
  category: MaterialCategory;
  subcategory: string;
  unit: string;
  unitPrice: string;
  currentQty: string;
  criticalLevel: string;
  flavorId: string;
  packagingId: string;
  supplierId: string;
  isDailySupply: boolean;
  isActive: boolean;
  notes: string;
}

function emptyForm(category: MaterialCategory): MaterialFormState {
  const defaultSub =
    category === "raw" ? RAW_SUBCATEGORIES[0].value : PACKAGING_SUBCATEGORIES[0].value;
  return {
    code: "",
    name: "",
    category,
    subcategory: defaultSub,
    unit: category === "raw" ? "kg" : "adet",
    unitPrice: "0",
    currentQty: "0",
    criticalLevel: "0",
    flavorId: "",
    packagingId: "",
    supplierId: "",
    isDailySupply: false,
    isActive: true,
    notes: "",
  };
}

function fromMaterial(material: MaterialRow): MaterialFormState {
  return {
    code: material.code,
    name: material.name,
    category: material.category,
    subcategory: material.subcategory ?? "",
    unit: material.unit,
    unitPrice: (material.unitPriceCents / 100).toFixed(2),
    currentQty: String(material.currentQty),
    criticalLevel: String(material.criticalLevel),
    flavorId: material.flavorId ?? "",
    packagingId: material.packagingId ?? "",
    supplierId: material.supplierId ?? "",
    isDailySupply: material.isDailySupply,
    isActive: material.isActive,
    notes: material.notes ?? "",
  };
}

function toPayload(form: MaterialFormState) {
  const unitPriceCents = parseBrlToCents(form.unitPrice) ?? 0;
  return {
    code: form.code,
    name: form.name,
    category: form.category,
    subcategory: form.subcategory || null,
    unit: form.unit,
    unitPriceCents,
    currentQty: Number(form.currentQty) || 0,
    criticalLevel: Number(form.criticalLevel) || 0,
    flavorId: form.flavorId || null,
    packagingId: form.packagingId || null,
    supplierId: form.supplierId || null,
    isDailySupply: form.isDailySupply,
    isActive: form.isActive,
    notes: form.notes.trim() || null,
  };
}

interface MaterialsSectionProps {
  initialMaterials: MaterialRow[];
  suppliers: SupplierOption[];
  flavors: FlavorOption[];
  packagings: PackagingOption[];
  capabilities: StockCapabilities;
  labels: Record<string, string>;
}

export function MaterialsSection({
  initialMaterials,
  suppliers,
  flavors,
  packagings,
  capabilities,
  labels,
}: MaterialsSectionProps) {
  const [materials, setMaterials] = useLiveState(initialMaterials);
  const [tab, setTab] = useState<MaterialCategory>("raw");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<MaterialFormState>(emptyForm("raw"));
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials
      .filter((m) => m.category === tab)
      .filter(
        (m) =>
          !q ||
          m.code.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          (m.flavorName?.toLowerCase().includes(q) ?? false),
      );
  }, [materials, tab, search]);

  const selected = materials.find((m) => m.id === selectedId);

  function selectMaterial(material: MaterialRow) {
    setSelectedId(material.id);
    setIsCreating(false);
    setForm(fromMaterial(material));
    clearErrors();
    setMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setForm(emptyForm(tab));
    clearErrors();
    setMessage("");
  }

  function switchTab(category: MaterialCategory) {
    setTab(category);
    setSearch("");
    setIsCreating(false);
    setSelectedId("");
    setForm(emptyForm(category));
    clearErrors();
    setMessage("");
  }

  async function handleSave() {
    if (!applyValidationErrors(validateMaterialForm(form))) return;

    setLoading(true);
    clearErrors();
    setMessage("");

    const payload = toPayload(form);

    try {
      if (isCreating) {
        const res = await apiFetch("/api/stock/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setMaterials((prev) => [...prev, data.material]);
        selectMaterial(data.material);
        setMessage(labels.created);
      } else if (selected) {
        const res = await apiFetch(`/api/stock/materials/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setMaterials((prev) =>
          prev.map((m) => (m.id === data.material.id ? data.material : m)),
        );
        setMessage(labels.saved);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`"${selected.name}" malzemesini kaldırmak istediğinize emin misiniz?`)) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/stock/materials/${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.deleteError);
        return;
      }
      if (data.deactivated) {
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === selected.id ? { ...m, isActive: false } : m,
          ),
        );
        setMessage(labels.deactivated);
      } else {
        setMaterials((prev) => prev.filter((m) => m.id !== selected.id));
        setIsCreating(false);
        setSelectedId("");
        setMessage(labels.deleted);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  const subcategoryOptions =
    form.category === "raw" ? RAW_SUBCATEGORIES : PACKAGING_SUBCATEGORIES;
  const showFlavorPackaging = form.category === "packaging";
  const requireFlavor = form.subcategory === "box";

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{labels.materialsTitle}</CardTitle>
              <CardDescription>
                {filtered.length} {labels.records}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {MATERIAL_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={tab === cat ? "default" : "outline"}
                  onClick={() => switchTab(cat)}
                >
                  {cat === "raw" ? labels.rawTab : labels.packagingTab}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">{labels.colCode}</th>
                  <th className="px-3 py-2 font-medium">{labels.colName}</th>
                  {tab === "packaging" && (
                    <th className="px-3 py-2 font-medium">{labels.colFlavorGram}</th>
                  )}
                  <th className="px-3 py-2 font-medium">{labels.colStock}</th>
                  <th className="px-3 py-2 font-medium">{labels.colPrice}</th>
                  <th className="px-3 py-2 font-medium">{labels.colSupplier}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((material) => (
                  <tr
                    key={material.id}
                    className={`border-b cursor-pointer hover:bg-muted/40 ${
                      selectedId === material.id && !isCreating ? "bg-primary/5" : ""
                    }`}
                    onClick={() => selectMaterial(material)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{material.code}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{material.name}</span>
                        {material.isDailySupply && (
                          <Badge variant="secondary" className="text-[10px]">
                            {labels.dailySupply}
                          </Badge>
                        )}
                        {!material.isActive && (
                          <Badge variant="outline" className="text-[10px]">
                            {labels.inactive}
                          </Badge>
                        )}
                        {material.isLowStock && material.isActive && (
                          <Badge variant="destructive" className="text-[10px]">
                            {labels.lowStock}
                          </Badge>
                        )}
                      </div>
                    </td>
                    {tab === "packaging" && (
                      <td className="px-3 py-2 text-muted-foreground">
                        {material.flavorName && material.packagingLabel
                          ? `${material.flavorName} · ${material.packagingLabel}`
                          : material.packagingLabel ?? "—"}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {material.currentQty} {material.unit}
                    </td>
                    <td className="px-3 py-2">
                      {formatBrlFromCents(material.unitPriceCents)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {material.supplierName ?? "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={tab === "packaging" ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">
                      {labels.noRecords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {capabilities.canCreate && (
            <Button variant="outline" size="sm" onClick={startCreate}>
              + {labels.newMaterial}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isCreating ? labels.newMaterial : selected?.name ?? labels.selectMaterial}
          </CardTitle>
          <CardDescription>{labels.formDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isCreating || selected) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={labels.colCode} error={fieldError("code")} required>
                  <Input
                    value={form.code}
                    onChange={(e) => {
                      setForm({ ...form, code: e.target.value.toUpperCase() });
                      clearFieldError("code");
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </FormField>
                <FormField label={labels.colName} error={fieldError("name")} required>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      clearFieldError("name");
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </FormField>
                <div className="space-y-2">
                  <Label>{labels.subcategory}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.subcategory}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    disabled={!capabilities.canEdit && !isCreating}
                  >
                    {subcategoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{labels.unit}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    disabled={!capabilities.canEdit && !isCreating}
                  >
                    {MATERIAL_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <FormField label={labels.colPrice} error={fieldError("unitPrice")}>
                  <Input
                    value={form.unitPrice}
                    onChange={(e) => {
                      setForm({ ...form, unitPrice: sanitizeMoneyInput(e.target.value) });
                      clearFieldError("unitPrice");
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                    placeholder="0,00"
                  />
                </FormField>
                <FormField label={labels.colStock} error={fieldError("currentQty")} required>
                  <Input
                    value={form.currentQty}
                    onChange={(e) => {
                      setForm({ ...form, currentQty: sanitizeDecimalInput(e.target.value) });
                      clearFieldError("currentQty");
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </FormField>
                <FormField label={labels.criticalLevel} error={fieldError("criticalLevel")}>
                  <Input
                    value={form.criticalLevel}
                    onChange={(e) => {
                      setForm({ ...form, criticalLevel: sanitizeDecimalInput(e.target.value) });
                      clearFieldError("criticalLevel");
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </FormField>
                <div className="space-y-2">
                  <Label>{labels.colSupplier}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    disabled={!capabilities.canEdit && !isCreating}
                  >
                    <option value="">{labels.noSupplier}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {showFlavorPackaging && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-3 bg-muted/20">
                  <p className="text-sm font-medium sm:col-span-2">
                    {labels.flavorGramaj}
                    {requireFlavor && <span className="text-destructive"> *</span>}
                  </p>
                  <FormField
                    label={labels.flavor}
                    error={fieldError("flavorId")}
                    required={requireFlavor}
                  >
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.flavorId}
                      onChange={(e) => {
                        setForm({ ...form, flavorId: e.target.value });
                        clearFieldError("flavorId");
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                    >
                      <option value="">{labels.selectFlavor}</option>
                      {flavors.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField
                    label={labels.gramaj}
                    error={fieldError("packagingId")}
                    required={requireFlavor}
                  >
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.packagingId}
                      onChange={(e) => {
                        setForm({ ...form, packagingId: e.target.value });
                        clearFieldError("packagingId");
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                    >
                      <option value="">{labels.selectGramaj}</option>
                      {packagings.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}

              <div className="space-y-2">
                <Label>{labels.notes}</Label>
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  disabled={!capabilities.canEdit && !isCreating}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.isDailySupply}
                    onChange={(e) => setForm({ ...form, isDailySupply: e.target.checked })}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                  {labels.dailySupplyFlag}
                </label>
                {!isCreating && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      disabled={!capabilities.canEdit}
                    />
                    {labels.active}
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(capabilities.canCreate && isCreating) || (capabilities.canEdit && !isCreating) ? (
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? labels.saving : isCreating ? labels.create : labels.save}
                  </Button>
                ) : null}
                {capabilities.canDelete && selected && !isCreating && (
                  <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                    {labels.delete}
                  </Button>
                )}
              </div>
            </>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
