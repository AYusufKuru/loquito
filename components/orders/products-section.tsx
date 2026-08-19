"use client";

import { useMemo, useState } from "react";

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
import { useFormErrors } from "@/hooks/use-form-errors";
import { apiFetch } from "@/lib/http";
import { validateProductForm } from "@/lib/forms/orders-validation";
import type {
  CatalogProductRow,
  OrdersCapabilities,
  PackagingPickOption,
  RecipePickOption,
} from "@/lib/orders/types";

interface ProductsSectionProps {
  products: CatalogProductRow[];
  recipes: RecipePickOption[];
  packagings: PackagingPickOption[];
  capabilities: OrdersCapabilities;
  labels: Record<string, string>;
  onCreated: (product: CatalogProductRow) => void;
}

export function ProductsSection({
  products,
  recipes,
  packagings,
  capabilities,
  labels,
  onCreated,
}: ProductsSectionProps) {
  const [isCreating, setIsCreating] = useState(products.length === 0);
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [packagingId, setPackagingId] = useState(packagings[0]?.id ?? "");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
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

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId],
  );

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setSku("");
    setName("");
    setRecipeId(recipes[0]?.id ?? "");
    setPackagingId(packagings[0]?.id ?? "");
    clearErrors();
    setMessage("");
  }

  function selectProduct(id: string) {
    setIsCreating(false);
    setSelectedId(id);
    clearErrors();
    setMessage("");
  }

  async function handleCreate() {
    if (!applyValidationErrors(validateProductForm({ recipeId, packagingId }))) {
      return;
    }
    if (recipes.length === 0) {
      showError(labels.noRecipesForProduct);
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      const res = await apiFetch("/api/orders/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          packagingId,
          sku: sku.trim() || null,
          name: name.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      const product = data.product as CatalogProductRow;
      onCreated(product);
      selectProduct(product.id);
      setMessage(labels.productCreated);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{labels.productsList}</CardTitle>
            <CardDescription>
              {products.length} {labels.records}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => selectProduct(product.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === product.id && !isCreating
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                <p className="font-medium">{product.sku}</p>
                <p className="text-xs text-muted-foreground">
                  {product.name}
                  {product.packagingLabel ? ` · ${product.packagingLabel}` : ""}
                </p>
              </button>
            ))}
            {capabilities.canCreate && (
              <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
                + {labels.newProduct}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isCreating
                ? labels.newProduct
                : selected?.sku || labels.selectProduct}
            </CardTitle>
            <CardDescription>{labels.productsTabDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCreating ? (
              <>
                {recipes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {labels.noRecipesForProduct}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      label={labels.productRecipe}
                      required
                      error={fieldError("recipeId")}
                    >
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={recipeId}
                        onChange={(e) => {
                          setRecipeId(e.target.value);
                          clearFieldError("recipeId");
                        }}
                      >
                        {recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.code} — {recipe.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      label={labels.productPackaging}
                      required
                      error={fieldError("packagingId")}
                    >
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={packagingId}
                        onChange={(e) => {
                          setPackagingId(e.target.value);
                          clearFieldError("packagingId");
                        }}
                      >
                        {packagings.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.label} ({pkg.unitsPerBox}/koli)
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={labels.productSku}>
                      <Input
                        value={sku}
                        onChange={(e) => setSku(e.target.value.toUpperCase())}
                        placeholder={labels.skuAuto}
                      />
                    </FormField>
                    <FormField label={labels.product}>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={labels.productNameAuto}
                      />
                    </FormField>
                  </div>
                )}
                {capabilities.canCreate && recipes.length > 0 ? (
                  <Button onClick={handleCreate} disabled={loading}>
                    {loading ? labels.saving : labels.create}
                  </Button>
                ) : null}
              </>
            ) : selected ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{labels.productSku}: </span>
                  {selected.sku}
                </p>
                <p>
                  <span className="text-muted-foreground">{labels.name}: </span>
                  {selected.name}
                </p>
                <p>
                  <span className="text-muted-foreground">{labels.productRecipe}: </span>
                  {selected.recipeCode
                    ? `${selected.recipeCode} — ${selected.recipeName}`
                    : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">{labels.productPackaging}: </span>
                  {selected.packagingLabel ?? "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{labels.noSellableProducts}</p>
            )}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
