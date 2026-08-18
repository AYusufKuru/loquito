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
import { validateMovementForm } from "@/lib/forms/stock-validation";
import { sanitizeDecimalInput } from "@/lib/forms/validation";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES } from "@/lib/stock/lot-constants";
import type {
  LotRow,
  MaterialRow,
  MovementRow,
  StockCapabilities,
} from "@/lib/stock/types";

interface MovementsSectionProps {
  initialMovements: MovementRow[];
  materials: MaterialRow[];
  releasedLots: LotRow[];
  capabilities: StockCapabilities;
  labels: Record<string, string>;
  onMaterialUpdated?: (materialId: string, currentQty: number) => void;
  onLotsRefresh?: () => void;
}

export function MovementsSection({
  initialMovements,
  materials,
  releasedLots,
  capabilities,
  labels,
  onMaterialUpdated,
  onLotsRefresh,
}: MovementsSectionProps) {
  const [movements, setMovements] = useState(initialMovements);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [type, setType] = useState<string>("in");
  const [quantity, setQuantity] = useState("");
  const [delta, setDelta] = useState("");
  const [lotId, setLotId] = useState("");
  const [createLot, setCreateLot] = useState(true);
  const [internalLotNo, setInternalLotNo] = useState("");
  const [supplierLotNo, setSupplierLotNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
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

  const materialLots = releasedLots.filter(
    (l) => l.materialId === materialId && l.isUsable && l.quantity > 0,
  );

  async function handleSubmit() {
    if (!capabilities.canCreate) return;
    if (
      !applyValidationErrors(
        validateMovementForm({ materialId, type, quantity, delta }),
      )
    ) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");

    const payload: Record<string, unknown> = {
      materialId,
      type,
      notes,
    };

    if (type === "adjustment") {
      payload.delta = Number(delta);
    } else {
      payload.quantity = Number(quantity);
      if (type === "in") {
        payload.createLot = createLot;
        if (internalLotNo) payload.internalLotNo = internalLotNo;
        if (supplierLotNo) payload.supplierLotNo = supplierLotNo;
        if (expiryDate) payload.expiryDate = expiryDate;
      }
      if (type === "out" || type === "scrap") {
        if (lotId) payload.lotId = lotId;
      }
    }

    try {
      const res = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }

      if (data.material && onMaterialUpdated) {
        onMaterialUpdated(data.material.id, data.material.currentQty);
      }

      const mat = materials.find((m) => m.id === materialId);
      const newMovement: MovementRow = {
        id: data.movement.id,
        materialId,
        materialCode: mat?.code ?? "",
        materialName: mat?.name ?? "",
        materialUnit: mat?.unit ?? "",
        lotId: data.movement.lotId,
        internalLotNo: null,
        type: data.movement.type,
        quantity: data.movement.quantity,
        notes: data.movement.notes,
        createdAt: data.movement.createdAt,
      };
      setMovements((prev) => [newMovement, ...prev]);
      setQuantity("");
      setDelta("");
      setNotes("");
      setMessage(labels.movementSaved);
      onLotsRefresh?.();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.movementsTitle}</CardTitle>
          <CardDescription>{movements.length} {labels.recentMovements}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">{labels.date}</th>
                  <th className="px-3 py-2 font-medium">{labels.colName}</th>
                  <th className="px-3 py-2 font-medium">{labels.movementType}</th>
                  <th className="px-3 py-2 font-medium">{labels.colStock}</th>
                  <th className="px-3 py-2 font-medium">{labels.lotNo}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-3 py-2">{m.materialName}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">
                        {MOVEMENT_TYPE_LABELS[m.type as keyof typeof MOVEMENT_TYPE_LABELS] ?? m.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {m.type === "adjustment" && m.quantity > 0 ? "+" : ""}
                      {m.quantity} {m.materialUnit}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.internalLotNo ?? "—"}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      {labels.noMovements}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {capabilities.canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.newMovement}</CardTitle>
            <CardDescription>{labels.newMovementDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label={labels.colName} error={fieldError("materialId")} required>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={materialId}
                onChange={(e) => {
                  setMaterialId(e.target.value);
                  setLotId("");
                  clearFieldError("materialId");
                }}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="space-y-2">
              <Label>{labels.movementType}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {type === "adjustment" ? (
              <FormField label={labels.delta} error={fieldError("delta")} required>
                <Input
                  value={delta}
                  onChange={(e) => {
                    setDelta(e.target.value);
                    clearFieldError("delta");
                  }}
                  placeholder="+10 veya -5"
                />
              </FormField>
            ) : (
              <FormField label={labels.quantity} error={fieldError("quantity")} required>
                <Input
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(sanitizeDecimalInput(e.target.value));
                    clearFieldError("quantity");
                  }}
                  placeholder="0"
                />
              </FormField>
            )}

            {type === "in" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={createLot}
                  onChange={(e) => setCreateLot(e.target.checked)}
                />
                {labels.createLot}
              </label>
            )}

            {type === "in" && createLot && (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                <div className="space-y-2">
                  <Label>{labels.lotNo}</Label>
                  <Input
                    value={internalLotNo}
                    onChange={(e) => setInternalLotNo(e.target.value)}
                    placeholder={labels.lotNoAuto}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{labels.supplierLot}</Label>
                  <Input
                    value={supplierLotNo}
                    onChange={(e) => setSupplierLotNo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{labels.skt}</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {(type === "out" || type === "scrap") && materialLots.length > 0 && (
              <div className="space-y-2">
                <Label>{labels.selectLot}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                >
                  <option value="">{labels.autoFifo}</option>
                  {materialLots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.internalLotNo} ({l.quantity} {l.materialUnit})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{labels.notes}</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? labels.saving : labels.recordMovement}
            </Button>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
