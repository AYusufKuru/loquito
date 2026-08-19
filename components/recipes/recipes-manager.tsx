"use client";

import { useMemo, useState } from "react";

import { RecipePackagingSection } from "@/components/recipes/recipe-packaging-section";
import { AuditHistoryPanel } from "@/components/audit/audit-history-panel";
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
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import {
  validateRecipeCopyForm,
  validateRecipeForm,
} from "@/lib/forms/recipe-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import { computeInputKg, computeScrapPercent } from "@/lib/recipes/compute";
import type {
  CustomerOption,
  FlavorOption,
  PackagingOption,
  RawMaterialOption,
  RecipeCapabilities,
  RecipeDetail,
  RecipeItemRow,
  RecipeRow,
} from "@/lib/recipes/types";

interface RawLine {
  materialId: string;
  quantity: string;
  unit: string;
  notes: string;
}

interface RecipesManagerProps {
  initialRecipes: RecipeRow[];
  flavors: FlavorOption[];
  customers: CustomerOption[];
  rawMaterials: RawMaterialOption[];
  packagingMaterials: RawMaterialOption[];
  packagings: PackagingOption[];
  capabilities: RecipeCapabilities;
  labels: Record<string, string>;
}

function emptyLine(materials: RawMaterialOption[]): RawLine {
  const first = materials[0];
  return {
    materialId: first?.id ?? "",
    quantity: "",
    unit: first?.unit ?? "kg",
    notes: "",
  };
}

function detailToLines(detail: RecipeDetail): RawLine[] {
  return detail.rawItems.map((i) => ({
    materialId: i.materialId ?? "",
    quantity: String(i.quantity),
    unit: i.unit,
    notes: i.notes ?? "",
  }));
}

function headerFromDetail(detail: RecipeDetail) {
  return {
    code: detail.code,
    name: detail.name,
    flavorId: detail.flavorId ?? "",
    customerId: detail.customerId ?? "",
    yieldKg: String(detail.yieldKg),
    notes: detail.notes ?? "",
    isActive: detail.isActive,
  };
}

function rowFromDetail(recipe: RecipeDetail): RecipeRow {
  return {
    id: recipe.id,
    code: recipe.code,
    name: recipe.name,
    flavorId: recipe.flavorId,
    flavorName: recipe.flavorName,
    flavorCode: recipe.flavorCode,
    customerId: recipe.customerId,
    customerName: recipe.customerName,
    yieldKg: recipe.yieldKg,
    scrapPercent: recipe.scrapPercent,
    version: recipe.version,
    isActive: recipe.isActive,
    notes: recipe.notes,
    rawItemCount: recipe.rawItems.length,
    packagingProfileCount: recipe.packagingProfiles.filter(
      (p) => p.items.length > 0,
    ).length,
    isCustomerSpecific: Boolean(recipe.customerId),
  };
}

export function RecipesManager({
  initialRecipes,
  flavors,
  customers,
  rawMaterials,
  packagingMaterials,
  packagings,
  capabilities,
  labels,
}: RecipesManagerProps) {
  const [recipes, setRecipes] = useLiveState(initialRecipes);
  const [selectedId, setSelectedId] = useState(initialRecipes[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState<"raw" | "packaging" | "history">("raw");
  const [detailFlavorCode, setDetailFlavorCode] = useState<string | null>(null);
  const [packagingProfiles, setPackagingProfiles] = useState<
    RecipeDetail["packagingProfiles"]
  >([]);
  const [savedRawItems, setSavedRawItems] = useState<RecipeItemRow[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [yieldKg, setYieldKg] = useState("70");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [lines, setLines] = useState<RawLine[]>([emptyLine(rawMaterials)]);

  const [copyCode, setCopyCode] = useState("");
  const [copyName, setCopyName] = useState("");
  const [copyFruitId, setCopyFruitId] = useState("");
  const [copyCustomerId, setCopyCustomerId] = useState("");
  const [showCopy, setShowCopy] = useState(false);

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

  const fruitMaterials = rawMaterials.filter(
    (m) => m.subcategory === "fruit" || m.code.startsWith("MEYVE_"),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter(
      (r) =>
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.flavorName?.toLowerCase().includes(q) ?? false),
    );
  }, [recipes, search]);

  const previewItems = lines
    .filter((l) => l.materialId && Number(l.quantity) > 0)
    .map((l) => ({
      id: "",
      materialId: l.materialId,
      materialCode: null,
      materialName: null,
      quantity: Number(l.quantity),
      unit: l.unit,
      notes: l.notes || null,
    }));

  const inputKg = computeInputKg(previewItems);
  const scrapPercent = computeScrapPercent(inputKg, Number(yieldKg) || 0);

  function resetCreate() {
    setIsCreating(true);
    setSelectedId("");
    setViewTab("raw");
    setCode("");
    setName("");
    setFlavorId(flavors[0]?.id ?? "");
    setCustomerId("");
    setYieldKg("70");
    setNotes("");
    setIsActive(true);
    setLines([emptyLine(rawMaterials)]);
    setShowCopy(false);
    clearErrors();
    setMessage("");
  }

  async function loadDetail(id: string) {
    const res = await apiFetch(`/api/recipes/${id}`);
    const data = await res.json();
    if (!res.ok) return;

    const detail = data.recipe as RecipeDetail;
    setSelectedId(id);
    setIsCreating(false);
    setShowCopy(false);
    setDetailFlavorCode(detail.flavorCode);
    setPackagingProfiles(detail.packagingProfiles);
    setSavedRawItems(detail.rawItems);
    const h = headerFromDetail(detail);
    setCode(h.code);
    setName(h.name);
    setFlavorId(h.flavorId);
    setCustomerId(h.customerId);
    setYieldKg(h.yieldKg);
    setNotes(h.notes);
    setIsActive(h.isActive);
    setLines(detailToLines(detail));
    setCopyCode(`${detail.code}-V${detail.version + 1}`);
    setCopyName(`${detail.name} (kopya)`);
    setCopyFruitId("");
    setCopyCustomerId(detail.customerId ?? "");
    clearErrors();
    setMessage("");
  }

  function buildPayload() {
    return {
      code,
      name,
      flavorId: flavorId || null,
      customerId: customerId || null,
      yieldKg: Number(yieldKg) || 70,
      notes: notes.trim() || null,
      rawItems: lines
        .filter((l) => l.materialId && Number(l.quantity) > 0)
        .map((l) => ({
          materialId: l.materialId,
          quantity: Number(l.quantity),
          unit: l.unit,
          notes: l.notes.trim() || null,
        })),
      isActive,
    };
  }

  async function handleSave() {
    if (
      !applyValidationErrors(
        validateRecipeForm({
          code,
          name,
          yieldKg,
          lines,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");

    const payload = buildPayload();

    try {
      if (isCreating) {
        const res = await apiFetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        const detail = data.recipe as RecipeDetail;
        const row = rowFromDetail(detail);
        setRecipes((prev) => [...prev, row]);
        await loadDetail(detail.id);
        setMessage(labels.created);
      } else if (selectedId) {
        const res = await apiFetch(`/api/recipes/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        const detail = data.recipe as RecipeDetail;
        const row = rowFromDetail(detail);
        setRecipes((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        setSavedRawItems(detail.rawItems);
        setPackagingProfiles(detail.packagingProfiles);
        setDetailFlavorCode(detail.flavorCode);
        setMessage(labels.saved);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!selectedId) return;
    if (!applyValidationErrors(validateRecipeCopyForm({ code: copyCode, name: copyName }))) {
      return;
    }

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/recipes/${selectedId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: copyCode,
          name: copyName,
          replaceFruitMaterialId: copyFruitId || null,
          customerId: copyCustomerId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.copyError);
        return;
      }
      const detail = data.recipe as RecipeDetail;
      const row = rowFromDetail(detail);
      setRecipes((prev) => [...prev, row]);
      await loadDetail(row.id);
      setShowCopy(false);
      setMessage(labels.copied);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function handlePackagingSaved(detail: RecipeDetail) {
    setPackagingProfiles(detail.packagingProfiles);
    const profileCount = detail.packagingProfiles.filter((p) => p.items.length > 0).length;
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === detail.id
          ? { ...r, version: detail.version, packagingProfileCount: profileCount }
          : r,
      ),
    );
  }

  const activeFlavorCode =
    detailFlavorCode ?? flavors.find((f) => f.id === flavorId)?.code ?? null;

  function updateLine(index: number, patch: Partial<RawLine>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.materialId) {
          const mat = rawMaterials.find((m) => m.id === patch.materialId);
          if (mat) next.unit = mat.unit;
        }
        return next;
      }),
    );
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.listTitle}</CardTitle>
          <CardDescription>{filtered.length} {labels.records}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => loadDetail(recipe.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === recipe.id && !isCreating
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{recipe.code}</span>
                {recipe.isCustomerSpecific && (
                  <Badge variant="secondary" className="text-[10px]">
                    {labels.customerSpecific}
                  </Badge>
                )}
              </div>
              <p className="font-medium">{recipe.name}</p>
              <p className="text-xs text-muted-foreground">
                {recipe.flavorName ?? "—"} · v{recipe.version}
                {recipe.packagingProfileCount > 0 && (
                  <> · {recipe.packagingProfileCount} {labels.packagingProfiles}</>
                )}
              </p>
            </button>
          ))}
          {capabilities.canCreate && (
            <Button variant="outline" size="sm" className="w-full" onClick={resetCreate}>
              + {labels.newRecipe}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isCreating ? labels.newRecipe : name || labels.selectRecipe}
            </CardTitle>
            <CardDescription>
              {viewTab === "raw"
                ? labels.headerDesc
                : viewTab === "packaging"
                  ? labels.packagingDesc
                  : labels.historyDesc}
            </CardDescription>
            {(isCreating || selectedId) && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant={viewTab === "raw" ? "default" : "outline"}
                  onClick={() => setViewTab("raw")}
                >
                  {labels.tabRaw}
                </Button>
                <Button
                  size="sm"
                  variant={viewTab === "packaging" ? "default" : "outline"}
                  onClick={() => setViewTab("packaging")}
                  disabled={isCreating}
                >
                  {labels.tabPackaging}
                </Button>
                <Button
                  size="sm"
                  variant={viewTab === "history" ? "default" : "outline"}
                  onClick={() => setViewTab("history")}
                  disabled={isCreating || !selectedId}
                >
                  {labels.historyTab}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {viewTab === "history" && selectedId && (
              <AuditHistoryPanel
                entityType="recipe"
                entityId={selectedId}
                labels={labels}
                compact
              />
            )}

            {(isCreating || selectedId) && viewTab !== "history" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={labels.code} error={fieldError("code")} required>
                    <Input
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        clearFieldError("code");
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </FormField>
                  <FormField label={labels.name} error={fieldError("name")} required>
                    <Input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldError("name");
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </FormField>
                  <div className="space-y-2">
                    <Label>{labels.flavor}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={flavorId}
                      onChange={(e) => setFlavorId(e.target.value)}
                      disabled={!capabilities.canEdit && !isCreating}
                    >
                      <option value="">{labels.noFlavor}</option>
                      {flavors.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{labels.customer}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      disabled={!capabilities.canEdit && !isCreating}
                    >
                      <option value="">{labels.noCustomer}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <FormField label={labels.yieldKg} error={fieldError("yieldKg")} required>
                    <Input
                      value={yieldKg}
                      onChange={(e) => {
                        setYieldKg(sanitizeDecimalInput(e.target.value));
                        clearFieldError("yieldKg");
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </FormField>
                  <div className="space-y-2">
                    <Label>{labels.scrapPercent}</Label>
                    <Input value={scrapPercent.toFixed(2)} readOnly disabled />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <span className="font-medium">{labels.inputKg}:</span> {inputKg.toFixed(2)} kg/L
                  <span className="mx-2">·</span>
                  <span className="font-medium">{labels.yieldKg}:</span> {yieldKg} kg
                </div>

                {viewTab === "raw" && (
                  <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>{labels.rawSection}</Label>
                    {capabilities.canEdit || isCreating ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLines((p) => [...p, emptyLine(rawMaterials)])}
                      >
                        + {labels.addLine}
                      </Button>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left">
                          <th className="px-3 py-2">{labels.material}</th>
                          <th className="px-3 py-2">{labels.quantity}</th>
                          <th className="px-3 py-2">{labels.unit}</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, index) => (
                          <tr key={index} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <select
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                                value={line.materialId}
                                onChange={(e) => {
                                  updateLine(index, { materialId: e.target.value });
                                  clearFieldError(`line-${index}-material`);
                                  clearFieldError("lines");
                                }}
                                disabled={!capabilities.canEdit && !isCreating}
                              >
                                {rawMaterials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.code} — {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={line.quantity}
                                onChange={(e) => {
                                  updateLine(index, {
                                    quantity: sanitizeDecimalInput(e.target.value),
                                  });
                                  clearFieldError(`line-${index}-qty`);
                                  clearFieldError("lines");
                                }}
                                disabled={!capabilities.canEdit && !isCreating}
                                className="h-8"
                                aria-invalid={Boolean(
                                  fieldError(`line-${index}-qty`) ||
                                    fieldError(`line-${index}-material`),
                                )}
                              />
                              {(fieldError(`line-${index}-qty`) ||
                                fieldError(`line-${index}-material`)) && (
                                <p className="mt-1 text-xs text-destructive">
                                  {fieldError(`line-${index}-qty`) ||
                                    fieldError(`line-${index}-material`)}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
                            <td className="px-3 py-2">
                              {(capabilities.canEdit || isCreating) && lines.length > 1 && (
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
                  {fieldError("lines") && (
                    <p className="mt-2 text-sm text-destructive">{fieldError("lines")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{labels.notes}</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(capabilities.canCreate && isCreating) ||
                  (capabilities.canEdit && !isCreating) ? (
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? labels.saving : isCreating ? labels.create : labels.save}
                    </Button>
                  ) : null}
                  {capabilities.canCreate && selectedId && !isCreating && (
                    <Button variant="outline" onClick={() => setShowCopy(!showCopy)}>
                      {labels.copyRecipe}
                    </Button>
                  )}
                </div>

                {showCopy && selectedId && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{labels.copyTitle}</CardTitle>
                      <CardDescription>{labels.copyDesc}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <FormField label={labels.code} error={fieldError("copyCode")} required>
                        <Input
                          value={copyCode}
                          onChange={(e) => {
                            setCopyCode(e.target.value.toUpperCase());
                            clearFieldError("copyCode");
                          }}
                        />
                      </FormField>
                      <FormField label={labels.name} error={fieldError("copyName")} required>
                        <Input
                          value={copyName}
                          onChange={(e) => {
                            setCopyName(e.target.value);
                            clearFieldError("copyName");
                          }}
                        />
                      </FormField>
                      <div className="space-y-2">
                        <Label>{labels.replaceFruit}</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={copyFruitId}
                          onChange={(e) => setCopyFruitId(e.target.value)}
                        >
                          <option value="">{labels.keepFruit}</option>
                          {fruitMaterials.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{labels.customer}</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={copyCustomerId}
                          onChange={(e) => setCopyCustomerId(e.target.value)}
                        >
                          <option value="">{labels.noCustomer}</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <Button onClick={handleCopy} disabled={loading}>
                          {labels.confirmCopy}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                  </>
                )}

                {viewTab === "packaging" && selectedId && !isCreating && (
                  <RecipePackagingSection
                    recipeId={selectedId}
                    flavorCode={activeFlavorCode}
                    yieldKg={Number(yieldKg) || 0}
                    rawItems={savedRawItems}
                    rawMaterials={rawMaterials}
                    packagingMaterials={packagingMaterials}
                    packagings={packagings}
                    initialProfiles={packagingProfiles}
                    canEdit={capabilities.canEdit}
                    labels={labels}
                    onSaved={handlePackagingSaved}
                  />
                )}
              </>
            )}

            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
