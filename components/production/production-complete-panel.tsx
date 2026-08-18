"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateProductionComplete } from "@/lib/forms/production-validation";
import { sanitizeDecimalInput, sanitizeIntInput } from "@/lib/forms/validation";
import type { SerializedProductionOrder } from "@/lib/production/serialize";

interface LotOption {
  id: string;
  materialId: string;
  internalLotNo: string;
  quantity: number;
}

interface ProductionCompletePanelProps {
  orderId: string;
  labels: Record<string, string>;
  onCompleted: () => void;
}

export function ProductionCompletePanel({
  orderId,
  labels,
  onCompleted,
}: ProductionCompletePanelProps) {
  const [detail, setDetail] = useState<SerializedProductionOrder | null>(null);
  const [lotsByMaterial, setLotsByMaterial] = useState<Record<string, LotOption[]>>({});
  const [lotsLoading, setLotsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [producedUnits, setProducedUnits] = useState("");
  const [scrapKg, setScrapKg] = useState("0");
  const [consumptionInputs, setConsumptionInputs] = useState<
    Record<string, { actualQty: string; lotId: string }>
  >({});
  const loadedLotMaterials = useRef(new Set<string>());
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const loadLots = useCallback(
    async (order: SerializedProductionOrder) => {
      const materialIds = [...new Set(order.consumptions.map((c) => c.materialId))];
      const missingIds = materialIds.filter((id) => !loadedLotMaterials.current.has(id));
      if (missingIds.length === 0) return;

      setLotsLoading(true);
      try {
        const results = await Promise.all(
          missingIds.map(async (materialId) => {
            const lotRes = await fetch(
              `/api/stock/lots?materialId=${materialId}&status=released`,
            );
            const lotData = await lotRes.json();
            if (!lotRes.ok) {
              return { materialId, availableQty: undefined, lots: [] as LotOption[] };
            }
            return {
              materialId,
              availableQty: lotData.availableQty as number | undefined,
              lots: lotData.lots.map((l: LotOption) => ({
                id: l.id,
                materialId: l.materialId,
                internalLotNo: l.internalLotNo,
                quantity: l.quantity,
              })),
            };
          }),
        );

        for (const { materialId } of results) {
          loadedLotMaterials.current.add(materialId);
        }

        setLotsByMaterial((prev) => {
          const next = { ...prev };
          for (const { materialId, lots } of results) {
            next[materialId] = lots;
          }
          return next;
        });
      } catch {
        showError(labels.connectionError);
      } finally {
        setLotsLoading(false);
      }
    },
    [labels.connectionError, showError],
  );

  useEffect(() => {
    let active = true;
    clearErrors();
    loadedLotMaterials.current.clear();
    setLotsByMaterial({});

    async function load() {
      const res = await fetch(`/api/production/orders/${orderId}`);
      const data = await res.json();
      if (!active) return;
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      const order = data.order as SerializedProductionOrder;
      setDetail(order);
      setProducedUnits(String(order.producedUnits || ""));
      setScrapKg(String(order.scrapKg || "0"));
      const inputs: Record<string, { actualQty: string; lotId: string }> = {};
      for (const c of order.consumptions) {
        inputs[c.id] = {
          actualQty: String(c.actualQty > 0 ? c.actualQty : c.plannedQty),
          lotId: c.lotId ?? "",
        };
      }
      setConsumptionInputs(inputs);
      void loadLots(order);
    }

    void load();
    return () => {
      active = false;
    };
  }, [clearErrors, loadLots, labels.loadError, orderId, showApiError]);

  async function handleComplete() {
    if (!detail) return;
    if (
      !applyValidationErrors(
        validateProductionComplete({
          producedUnits,
          scrapKg,
          consumptions: detail.consumptions.map((c) => ({
            id: c.id,
            materialCode: c.materialCode,
            actualQty: consumptionInputs[c.id]?.actualQty ?? "",
          })),
        }),
      )
    ) {
      return;
    }

    setActionLoading(true);
    clearErrors();
    try {
      const res = await fetch(`/api/production/orders/${detail.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producedUnits: Number(producedUnits),
          scrapKg: Number(scrapKg) || 0,
          consumptions: detail.consumptions.map((c) => ({
            consumptionId: c.id,
            actualQty: Number(consumptionInputs[c.id]?.actualQty ?? c.plannedQty),
            lotId: consumptionInputs[c.id]?.lotId || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.completeError);
        return;
      }
      onCompleted();
    } catch {
      showError(labels.connectionError);
    } finally {
      setActionLoading(false);
    }
  }

  if (!detail) {
    return <p className="text-sm text-muted-foreground">{labels.loading}</p>;
  }

  return (
    <>
      {ErrorModal}
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <p className="text-sm font-medium">{labels.completeSection}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label={labels.producedUnits}
            error={fieldError("producedUnits")}
            required
          >
            <Input
              value={producedUnits}
              onChange={(e) => {
                setProducedUnits(sanitizeIntInput(e.target.value));
                clearFieldError("producedUnits");
              }}
            />
          </FormField>
          <FormField label={labels.scrapKg} error={fieldError("scrapKg")}>
            <Input
              value={scrapKg}
              onChange={(e) => {
                setScrapKg(sanitizeDecimalInput(e.target.value));
                clearFieldError("scrapKg");
              }}
            />
          </FormField>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2">{labels.material}</th>
                <th className="px-3 py-2">{labels.plannedQty}</th>
                <th className="px-3 py-2">{labels.actualQty}</th>
                <th className="px-3 py-2">{labels.lot}</th>
              </tr>
            </thead>
            <tbody>
              {detail.consumptions.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{c.materialCode}</span>
                    <span className="block text-muted-foreground">{c.materialName}</span>
                  </td>
                  <td className="px-3 py-2">
                    {c.plannedQty} {c.unit}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-24"
                      value={consumptionInputs[c.id]?.actualQty ?? ""}
                      onChange={(e) => {
                        const value = sanitizeDecimalInput(e.target.value);
                        setConsumptionInputs((prev) => ({
                          ...prev,
                          [c.id]: { ...prev[c.id], actualQty: value },
                        }));
                        clearFieldError(`consumption-${c.id}`);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="h-8 min-w-[120px] rounded-md border px-2 text-xs"
                      value={consumptionInputs[c.id]?.lotId ?? ""}
                      disabled={lotsLoading}
                      onChange={(e) =>
                        setConsumptionInputs((prev) => ({
                          ...prev,
                          [c.id]: { ...prev[c.id], lotId: e.target.value },
                        }))
                      }
                    >
                      <option value="">{labels.autoLot}</option>
                      {(lotsByMaterial[c.materialId] ?? []).map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.internalLotNo} ({lot.quantity})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button onClick={handleComplete} disabled={actionLoading || lotsLoading}>
          {labels.closeBatch}
        </Button>
      </div>
    </>
  );
}
