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
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import { validateTaxLocationForm } from "@/lib/forms/finance-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import type { TaxLocationRow } from "@/lib/finance/tax-locations";

interface TaxLocationsSectionProps {
  initialLocations: TaxLocationRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  labels: Record<string, string>;
}

function emptyForm() {
  return {
    code: "",
    name: "",
    taxPercent: "",
    notes: "",
    isActive: true,
  };
}

export function TaxLocationsSection({
  initialLocations,
  canCreate,
  canEdit,
  canDelete,
  labels,
}: TaxLocationsSectionProps) {
  const [locations, setLocations] = useLiveState(initialLocations);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/finance/tax-locations");
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setLocations(data.locations ?? []);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError, setLocations, showApiError, showError]);

  useEffect(() => {
    if (initialLocations.length === 0) void load();
  }, [initialLocations.length, load]);

  async function handleCreate() {
    if (
      !applyValidationErrors(
        validateTaxLocationForm({
          code: form.code,
          taxPercent: form.taxPercent,
        }),
      )
    ) {
      return;
    }
    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/finance/tax-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name.trim() || null,
          taxPercent: Number(form.taxPercent.replace(",", ".")),
          notes: form.notes.trim() || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setLocations((prev) =>
        [...prev, data.location].sort((a, b) => a.code.localeCompare(b.code)),
      );
      setForm(emptyForm());
      setIsCreating(false);
      setMessage(labels.taxLocationCreated);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(row: TaxLocationRow) {
    setEditingId(row.id);
    setEditForm({
      code: row.code,
      name: row.name ?? "",
      taxPercent: String(row.taxPercent),
      notes: row.notes ?? "",
      isActive: row.isActive,
    });
    clearErrors();
    setMessage("");
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    if (
      !applyValidationErrors(
        validateTaxLocationForm({
          code: editForm.code,
          taxPercent: editForm.taxPercent,
        }),
      )
    ) {
      return;
    }
    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch(`/api/finance/tax-locations/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editForm.code,
          name: editForm.name.trim() || null,
          taxPercent: Number(editForm.taxPercent.replace(",", ".")),
          notes: editForm.notes.trim() || null,
          isActive: editForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setLocations((prev) =>
        prev
          .map((row) => (row.id === data.location.id ? data.location : row))
          .sort((a, b) => a.code.localeCompare(b.code)),
      );
      setEditingId(null);
      setMessage(labels.saved);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch(`/api/finance/tax-locations/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.deleteError);
        return;
      }
      if (data.deactivated) {
        setLocations((prev) =>
          prev.map((row) => (row.id === id ? { ...row, isActive: false } : row)),
        );
        setMessage(labels.taxLocationDeactivated);
      } else {
        setLocations((prev) => prev.filter((row) => row.id !== id));
        setMessage(labels.taxLocationDeleted);
      }
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {ErrorModal}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{labels.taxLocationsTitle}</CardTitle>
            <CardDescription>{labels.taxLocationsDesc}</CardDescription>
          </div>
          {canCreate && !isCreating && (
            <Button onClick={() => setIsCreating(true)}>{labels.addTaxLocation}</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          {isCreating && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">{labels.newTaxLocation}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label={labels.taxCode} error={fieldError("code")} required>
                  <Input
                    value={form.code}
                    onChange={(e) => {
                      clearFieldError("code");
                      setForm((f) => ({ ...f, code: e.target.value }));
                    }}
                    placeholder="SP"
                  />
                </FormField>
                <FormField label={labels.taxLocationName}>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={labels.taxLocationNameHint}
                  />
                </FormField>
                <FormField label={labels.taxPercent} error={fieldError("taxPercent")} required>
                  <Input
                    value={form.taxPercent}
                    inputMode="decimal"
                    onChange={(e) => {
                      clearFieldError("taxPercent");
                      setForm((f) => ({
                        ...f,
                        taxPercent: sanitizeDecimalInput(e.target.value),
                      }));
                    }}
                    placeholder="18"
                  />
                </FormField>
              </div>
              <div className="space-y-2">
                <Label>{labels.notes}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                {labels.isActive}
              </label>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={loading}>
                  {loading ? labels.saving : labels.create}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setForm(emptyForm());
                    clearErrors();
                  }}
                >
                  {labels.cancel}
                </Button>
              </div>
            </div>
          )}

          {locations.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{labels.noTaxLocations}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{labels.taxCode}</th>
                    <th className="py-2 pr-3 font-medium">{labels.taxLocationName}</th>
                    <th className="py-2 pr-3 font-medium">{labels.taxPercent}</th>
                    <th className="py-2 pr-3 font-medium">{labels.status}</th>
                    <th className="py-2 font-medium">{labels.notes}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {locations.map((row) =>
                    editingId === row.id ? (
                      <tr key={row.id} className="border-b bg-muted/30">
                        <td className="py-2 pr-3">
                          <Input
                            className="h-8"
                            value={editForm.code}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, code: e.target.value }))
                            }
                          />
                          {fieldError("code") && (
                            <p className="mt-1 text-xs text-destructive">{fieldError("code")}</p>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            className="h-8"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, name: e.target.value }))
                            }
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            className="h-8 w-24"
                            value={editForm.taxPercent}
                            inputMode="decimal"
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                taxPercent: sanitizeDecimalInput(e.target.value),
                              }))
                            }
                          />
                          {fieldError("taxPercent") && (
                            <p className="mt-1 text-xs text-destructive">
                              {fieldError("taxPercent")}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editForm.isActive}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, isActive: e.target.checked }))
                              }
                            />
                            {labels.isActive}
                          </label>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            className="h-8"
                            value={editForm.notes}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, notes: e.target.value }))
                            }
                          />
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <Button size="sm" onClick={handleSaveEdit} disabled={loading}>
                            {labels.save}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            {labels.cancel}
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id} className="border-b">
                        <td className="py-2 pr-3 font-medium">{row.code}</td>
                        <td className="py-2 pr-3">{row.name || "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{row.taxPercent}%</td>
                        <td className="py-2 pr-3">
                          <Badge variant={row.isActive ? "secondary" : "outline"}>
                            {row.isActive ? labels.isActive : labels.inactive}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{row.notes || "—"}</td>
                        <td className="py-2 whitespace-nowrap">
                          {canEdit && (
                            <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                              {labels.edit}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(row.id)}
                              disabled={loading}
                            >
                              {labels.delete}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
