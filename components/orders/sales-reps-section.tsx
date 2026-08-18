"use client";

import { useState } from "react";

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
import { validateSalesRepForm } from "@/lib/forms/orders-validation";
import type { OrdersCapabilities, SalesRepRow } from "@/lib/pricing/types";

interface SalesRepsSectionProps {
  initialSalesReps: SalesRepRow[];
  capabilities: OrdersCapabilities;
  labels: Record<string, string>;
}

interface RepForm {
  name: string;
  company: string;
  region: string;
  address: string;
  cep: string;
  phone: string;
  email: string;
  isActive: boolean;
}

function emptyForm(): RepForm {
  return {
    name: "",
    company: "",
    region: "",
    address: "",
    cep: "",
    phone: "",
    email: "",
    isActive: true,
  };
}

function fromRep(rep: SalesRepRow): RepForm {
  return {
    name: rep.name,
    company: rep.company ?? "",
    region: rep.region ?? "",
    address: rep.address ?? "",
    cep: rep.cep ?? "",
    phone: rep.phone ?? "",
    email: rep.email ?? "",
    isActive: rep.isActive,
  };
}

export function SalesRepsSection({
  initialSalesReps,
  capabilities,
  labels,
}: SalesRepsSectionProps) {
  const [reps, setReps] = useState(initialSalesReps);
  const [selectedId, setSelectedId] = useState(initialSalesReps[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<RepForm>(emptyForm());
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

  function selectRep(rep: SalesRepRow) {
    setSelectedId(rep.id);
    setIsCreating(false);
    setForm(fromRep(rep));
    clearErrors();
    setMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setForm(emptyForm());
    clearErrors();
    setMessage("");
  }

  async function handleSave() {
    if (!applyValidationErrors(validateSalesRepForm(form))) return;

    setLoading(true);
    clearErrors();
    setMessage("");
    try {
      if (isCreating) {
        const res = await fetch("/api/orders/sales-reps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setReps((prev) => [...prev, data.salesRep]);
        selectRep(data.salesRep);
        setMessage(labels.created);
      } else if (selectedId) {
        const res = await fetch(`/api/orders/sales-reps/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, labels.saveError);
          return;
        }
        setReps((prev) =>
          prev.map((r) => (r.id === data.salesRep.id ? data.salesRep : r)),
        );
        setMessage(labels.saved);
      }
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
            <CardTitle className="text-base">{labels.salesRepsList}</CardTitle>
            <CardDescription>{reps.length} {labels.records}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reps.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => selectRep(rep)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === rep.id && !isCreating
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                <p className="font-medium">{rep.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rep.region ?? "—"} · {rep.customerCount} {labels.customersShort}
                </p>
              </button>
            ))}
            {capabilities.canCreate && (
              <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
                + {labels.newSalesRep}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isCreating ? labels.newSalesRep : form.name || labels.selectSalesRep}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(isCreating || selectedId) && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label={labels.name}
                    required
                    error={fieldError("name")}
                  >
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
                  <FormField label={labels.company}>
                    <Input
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </FormField>
                  <FormField label={labels.region}>
                    <Input
                      value={form.region}
                      onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </FormField>
                  <FormField label={labels.phone}>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      disabled={!capabilities.canEdit && !isCreating}
                    />
                  </FormField>
                  <FormField
                    label={labels.email}
                    className="sm:col-span-2"
                    error={fieldError("email")}
                  >
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        clearFieldError("email");
                        setForm((f) => ({ ...f, email: e.target.value }));
                      }}
                      disabled={!capabilities.canEdit && !isCreating}
                      aria-invalid={!!fieldError("email")}
                    />
                  </FormField>
                </div>
                {(capabilities.canCreate && isCreating) ||
                (capabilities.canEdit && !isCreating) ? (
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? labels.saving : isCreating ? labels.create : labels.save}
                  </Button>
                ) : null}
              </>
            )}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
