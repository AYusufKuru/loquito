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
import { validatePackagingForm } from "@/lib/forms/recipe-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import {
  buildCostResult,
  boxesPerBatch,
  computePackagingCostCents,
  computeRawCostCents,
  isPerBatchItem,
} from "@/lib/recipes/cost";
import type {
  PackagingOption,
  PackagingProfile,
  RawMaterialOption,
  RecipeCostResult,
  RecipeDetail,
  RecipeItemRow,
} from "@/lib/recipes/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface PackagingLine {
  materialId: string;
  quantity: string;
  unit: string;
  notes: string;
}

interface RecipePackagingSectionProps {
  recipeId: string;
  flavorCode: string | null;
  yieldKg: number;
  rawItems: RecipeItemRow[];
  rawMaterials: RawMaterialOption[];
  packagingMaterials: RawMaterialOption[];
  packagings: PackagingOption[];
  initialProfiles: PackagingProfile[];
  canEdit: boolean;
  labels: Record<string, string>;
  onSaved: (detail: RecipeDetail) => void;
}

function profileToLines(profile: PackagingProfile | undefined): PackagingLine[] {
  if (!profile || profile.items.length === 0) return [];
  return profile.items.map((i) => ({
    materialId: i.materialId ?? "",
    quantity: String(i.quantity),
    unit: i.unit,
    notes: i.notes ?? "",
  }));
}

function emptyPackagingLine(materials: RawMaterialOption[]): PackagingLine {
  const first = materials[0];
  return {
    materialId: first?.id ?? "",
    quantity: "",
    unit: first?.unit ?? "adet",
    notes: "",
  };
}

export function RecipePackagingSection({
  recipeId,
  flavorCode,
  yieldKg,
  rawItems,
  rawMaterials,
  packagingMaterials,
  packagings,
  initialProfiles,
  canEdit,
  labels,
  onSaved,
}: RecipePackagingSectionProps) {
  const [packagingId, setPackagingId] = useState(packagings[0]?.id ?? "");
  const [lines, setLines] = useState<PackagingLine[]>([]);
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

  const selectedPackaging = packagings.find((p) => p.id === packagingId);

  const syncFromProfiles = useCallback(
    (profiles: PackagingProfile[], pkgId: string) => {
      const profile = profiles.find((p) => p.packagingId === pkgId);
      const nextLines = profileToLines(profile);
      setLines(
        nextLines.length > 0 ? nextLines : [emptyPackagingLine(packagingMaterials)],
      );
    },
    [packagingMaterials],
  );

  useEffect(() => {
    if (!packagingId && packagings[0]) {
      setPackagingId(packagings[0].id);
      return;
    }
    syncFromProfiles(initialProfiles, packagingId);
  }, [recipeId, packagingId, initialProfiles, packagings, syncFromProfiles]);

  const rawPrices = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of rawMaterials) map.set(m.id, m.unitPriceCents);
    for (const m of packagingMaterials) map.set(m.id, m.unitPriceCents);
    return map;
  }, [rawMaterials, packagingMaterials]);

  const costPreview = useMemo((): RecipeCostResult | null => {
    if (!selectedPackaging) return null;

    const packagingItems = lines
      .filter((l) => l.materialId && Number(l.quantity) > 0)
      .map((l) => {
        const mat = packagingMaterials.find((m) => m.id === l.materialId);
        return {
          id: "",
          materialId: l.materialId,
          materialCode: mat?.code ?? null,
          materialName: mat?.name ?? null,
          quantity: Number(l.quantity),
          unit: l.unit,
          notes: l.notes || null,
          packagingId,
          subcategory: mat?.subcategory ?? null,
          unitPriceCents: mat?.unitPriceCents ?? 0,
          perBatch: isPerBatchItem(mat?.subcategory ?? null, l.notes || null),
        };
      });

    const batchBoxes = boxesPerBatch(yieldKg, selectedPackaging.netWeightG);
    const rawCostCents = computeRawCostCents(rawItems, rawPrices);
    const packagingCostCents = computePackagingCostCents(packagingItems, batchBoxes);

    return buildCostResult(
      packagingId,
      selectedPackaging.label,
      selectedPackaging.netWeightG,
      selectedPackaging.unitsPerBox,
      yieldKg,
      rawCostCents,
      packagingCostCents,
    );
  }, [lines, packagingId, packagingMaterials, rawItems, rawPrices, selectedPackaging, yieldKg]);

  async function loadTemplate() {
    if (!packagingId) return;
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch(
        `/api/recipes/${recipeId}/packaging-template?packagingId=${packagingId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.templateError);
        return;
      }
      const items = data.items as Array<{
        materialId: string;
        quantity: number;
        unit: string;
        notes?: string | null;
      }>;
      if (items.length === 0) {
        showError(labels.templateEmpty);
        return;
      }
      setLines(
        items.map((i) => ({
          materialId: i.materialId,
          quantity: String(i.quantity),
          unit: i.unit,
          notes: i.notes ?? "",
        })),
      );
      setMessage(labels.templateLoaded);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (
      !applyValidationErrors(
        validatePackagingForm({
          packagingId,
          packagingLabel: labels.packagingGrammage,
          lines,
        }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");

    const payload = {
      packagingId,
      items: lines
        .filter((l) => l.materialId && Number(l.quantity) > 0)
        .map((l) => ({
          materialId: l.materialId,
          quantity: Number(l.quantity),
          unit: l.unit,
          notes: l.notes.trim() || null,
        })),
    };

    try {
      const res = await fetch(`/api/recipes/${recipeId}/packaging`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      onSaved(data.recipe as RecipeDetail);
      setMessage(labels.saved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function updateLine(index: number, patch: Partial<PackagingLine>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.materialId) {
          const mat = packagingMaterials.find((m) => m.id === patch.materialId);
          if (mat) next.unit = mat.unit;
        }
        return next;
      }),
    );
  }

  if (packagings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{labels.noPackagingOptions}</p>
    );
  }

  return (
    <>
      {ErrorModal}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            label={labels.packagingGrammage}
            error={fieldError("packagingId")}
            required
            className="min-w-[180px]"
          >
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={packagingId}
              onChange={(e) => {
                setPackagingId(e.target.value);
                clearFieldError("packagingId");
              }}
            >
              {packagings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.netWeightG}g · {p.unitsPerBox}/koli)
                </option>
              ))}
            </select>
          </FormField>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={loadTemplate} disabled={loading}>
              {labels.loadTemplate}
            </Button>
          )}
          {flavorCode && (
            <Badge variant="secondary" className="text-xs">
              {labels.flavorCode}: {flavorCode}
            </Badge>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>{labels.packagingSection}</Label>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setLines((p) => [...p, emptyPackagingLine(packagingMaterials)])
                }
              >
                + {labels.addLine}
              </Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2">{labels.material}</th>
                  <th className="px-3 py-2">{labels.quantity}</th>
                  <th className="px-3 py-2">{labels.unit}</th>
                  <th className="px-3 py-2">{labels.perBatch}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const mat = packagingMaterials.find((m) => m.id === line.materialId);
                  const perBatch = isPerBatchItem(
                    mat?.subcategory ?? null,
                    line.notes || null,
                  );
                  const lineError =
                    fieldError(`pkg-${index}-qty`) || fieldError(`pkg-${index}-material`);
                  return (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                          value={line.materialId}
                          onChange={(e) => {
                            updateLine(index, { materialId: e.target.value });
                            clearFieldError(`pkg-${index}-material`);
                          }}
                          disabled={!canEdit}
                        >
                          {packagingMaterials.map((m) => (
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
                            clearFieldError(`pkg-${index}-qty`);
                          }}
                          disabled={!canEdit}
                          className="h-8"
                          aria-invalid={Boolean(lineError)}
                        />
                        {lineError && (
                          <p className="mt-1 text-xs text-destructive">{lineError}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
                      <td className="px-3 py-2">
                        {perBatch ? (
                          <Badge variant="outline" className="text-[10px]">
                            {labels.perBatchYes}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {labels.perBox}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit && lines.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLines((p) => p.filter((_, i) => i !== index))}
                          >
                            ×
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {costPreview && (
          <Card className="border-dashed bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{labels.costTitle}</CardTitle>
              <CardDescription>
                {labels.boxesPerBatch}: {costPreview.boxesPerBatch}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <span className="text-muted-foreground">{labels.rawCost}:</span>{" "}
                <span className="font-medium">
                  {formatBrlFromCents(costPreview.rawCostCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{labels.packagingCost}:</span>{" "}
                <span className="font-medium">
                  {formatBrlFromCents(costPreview.packagingCostCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{labels.batchCost}:</span>{" "}
                <span className="font-medium">
                  {formatBrlFromCents(costPreview.totalBatchCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{labels.perKgCost}:</span>{" "}
                <span className="font-medium">
                  {formatBrlFromCents(costPreview.perKgCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{labels.perBoxCost}:</span>{" "}
                <span className="font-semibold text-primary">
                  {formatBrlFromCents(costPreview.perBoxCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{labels.perShipBoxCost}:</span>{" "}
                <span className="font-semibold text-primary">
                  {formatBrlFromCents(costPreview.perShipBoxCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {canEdit && (
          <Button onClick={handleSave} disabled={loading}>
            {loading ? labels.saving : labels.savePackaging}
          </Button>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </>
  );
}
