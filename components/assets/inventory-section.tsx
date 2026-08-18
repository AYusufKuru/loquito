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
import { ASSET_CATEGORIES } from "@/lib/assets/constants";
import type { AssetRow } from "@/lib/assets/types";
import {
  formatBrlFromCents,
} from "@/lib/stock/constants";

interface InventorySectionProps {
  initialAssets: AssetRow[];
  initialTotalValueCents: number;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  labels: Record<string, string>;
}

function emptyForm() {
  return {
    name: "",
    category: ASSET_CATEGORIES[0].value as string,
    quantity: "1",
    value: "",
    location: "",
    notes: "",
    isActive: true,
  };
}

export function InventorySection({
  initialAssets,
  initialTotalValueCents,
  canCreate,
  canEdit,
  canDelete,
  labels,
}: InventorySectionProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [totalValueCents, setTotalValueCents] = useState(initialTotalValueCents);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/assets/inventory");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.loadError);
        return;
      }
      setAssets(data.assets);
      setTotalValueCents(data.totalValueCents);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryLabel = useMemo(() => {
    const map = Object.fromEntries(
      ASSET_CATEGORIES.map((c) => [c.value, c.label]),
    );
    return (value: string | null) =>
      value ? map[value] ?? value : labels.noCategory;
  }, [labels.noCategory]);

  async function createAsset() {
    if (!canCreate) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/assets/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          quantity: Number(form.quantity) || 1,
          value: form.value,
          location: form.location || null,
          notes: form.notes || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.saveError);
        return;
      }
      setMessage(labels.created);
      setForm(emptyForm());
      setIsCreating(false);
      await load();
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(asset: AssetRow) {
    if (!canEdit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/assets/inventory/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !asset.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.saveError);
        return;
      }
      setMessage(labels.saved);
      await load();
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function deleteAsset(id: string) {
    if (!canDelete) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/assets/inventory/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.deleteError);
        return;
      }
      setMessage(labels.deleted);
      await load();
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.itemCount}</CardDescription>
            <CardTitle className="text-2xl">{assets.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.totalValue}</CardDescription>
            <CardTitle className="text-2xl">
              {formatBrlFromCents(totalValueCents)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.activeCount}</CardDescription>
            <CardTitle className="text-2xl">
              {assets.filter((a) => a.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {message && (
        <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <Button
            type="button"
            variant={isCreating ? "secondary" : "default"}
            onClick={() => setIsCreating((v) => !v)}
          >
            {isCreating ? labels.cancel : labels.addAsset}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={load} disabled={loading}>
          {labels.refresh}
        </Button>
      </div>

      {isCreating && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>{labels.newAsset}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{labels.name}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.category}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{labels.quantity}</Label>
              <Input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.value}</Label>
              <Input
                placeholder="0,00"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.location}</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label>{labels.notes}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" onClick={createAsset} disabled={loading}>
                {loading ? labels.saving : labels.create}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{labels.inventoryTitle}</CardTitle>
          <CardDescription>{labels.inventoryDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noAssets}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">{labels.name}</th>
                    <th className="pb-2 pr-4">{labels.category}</th>
                    <th className="pb-2 pr-4">{labels.quantity}</th>
                    <th className="pb-2 pr-4">{labels.value}</th>
                    <th className="pb-2 pr-4">{labels.location}</th>
                    <th className="pb-2 pr-4">{labels.status}</th>
                    <th className="pb-2">{labels.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{asset.name}</td>
                      <td className="py-2 pr-4">
                        {categoryLabel(asset.category)}
                      </td>
                      <td className="py-2 pr-4">{asset.quantity}</td>
                      <td className="py-2 pr-4">
                        {formatBrlFromCents(asset.valueCents)}
                      </td>
                      <td className="py-2 pr-4">{asset.location ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={asset.isActive ? "secondary" : "outline"}>
                          {asset.isActive ? labels.active : labels.inactive}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActive(asset)}
                            >
                              {asset.isActive ? labels.deactivate : labels.activate}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteAsset(asset.id)}
                            >
                              {labels.delete}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
