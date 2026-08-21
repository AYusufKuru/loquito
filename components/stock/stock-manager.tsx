"use client";

import { useCallback, useState } from "react";

import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";

import { PurchaseOrdersSection } from "@/components/stock/purchase-orders-section";
import { FinishedGoodsSection } from "@/components/stock/finished-goods-section";
import { SeparatedStockSection } from "@/components/stock/separated-stock-section";
import { AlertsSummary } from "@/components/stock/alerts-summary";
import { LotsSection } from "@/components/stock/lots-section";
import { MaterialsSection } from "@/components/stock/materials-section";
import { MovementsSection } from "@/components/stock/movements-section";
import { cn } from "@/lib/utils";
import type {
  FinishedStockMatrixCell,
  FinishedStockReservationRow,
  FinishedStockRow,
  FinishedStockSummary,
} from "@/lib/finished-stock/types";
import type { SeparatedStockRow } from "@/lib/separated-stock/types";
import type {
  FlavorOption,
  LotRow,
  MaterialRow,
  MovementRow,
  PackagingOption,
  StockCapabilities,
  StockSummary,
  SupplierOption,
} from "@/lib/stock/types";

type StockTab =
  | "overview"
  | "materials"
  | "purchaseOrders"
  | "lots"
  | "movements"
  | "finished"
  | "separated";

interface StockManagerProps {
  materials: MaterialRow[];
  lots: LotRow[];
  movements: MovementRow[];
  summary: StockSummary;
  suppliers: SupplierOption[];
  flavors: FlavorOption[];
  packagings: PackagingOption[];
  capabilities: StockCapabilities;
  finishedRows: FinishedStockRow[];
  finishedMatrix: FinishedStockMatrixCell[];
  finishedSummary: FinishedStockSummary;
  finishedReservations: FinishedStockReservationRow[];
  separatedRows: SeparatedStockRow[];
  reserveOrders: Array<{
    id: string;
    orderNo: string;
    customerName: string;
    status: string;
  }>;
  labels: Record<string, string>;
}

export function StockManager({
  materials: initialMaterials,
  lots: initialLots,
  movements: initialMovements,
  summary: initialSummary,
  suppliers,
  flavors,
  packagings,
  capabilities,
  finishedRows,
  finishedMatrix,
  finishedSummary,
  finishedReservations,
  separatedRows,
  reserveOrders,
  labels,
}: StockManagerProps) {
  const [tab, setTab] = useState<StockTab>("overview");
  const [materials, setMaterials] = useLiveState(initialMaterials);
  const [lots, setLots] = useLiveState(initialLots);
  const [summary, setSummary] = useLiveState(initialSummary);

  const refreshLots = useCallback(async () => {
    try {
      const res = await apiFetch("/api/stock/lots");
      const data = await res.json();
      if (res.ok) setLots(data.lots);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const res = await apiFetch("/api/stock/summary");
      const data = await res.json();
      if (res.ok) setSummary(data.summary);
    } catch {
      /* ignore */
    }
  }, []);

  function handleMaterialUpdated(materialId: string, currentQty: number) {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === materialId
          ? {
              ...m,
              currentQty,
              isLowStock: m.criticalLevel > 0 && currentQty <= m.criticalLevel,
            }
          : m,
      ),
    );
    refreshSummary();
    refreshLots();
  }

  const tabs: { id: StockTab; label: string }[] = [
    { id: "overview", label: labels.overviewTab },
    { id: "materials", label: labels.materialsTab },
    { id: "purchaseOrders", label: labels.purchaseOrdersTab },
    { id: "lots", label: labels.lotsTab },
    { id: "movements", label: labels.movementsTab },
    { id: "finished", label: labels.finishedTab },
    { id: "separated", label: labels.separatedTab },
  ];

  const releasedLots = lots.filter((l) => l.isUsable);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <AlertsSummary summary={summary} labels={labels} />}
        {tab === "materials" && (
          <MaterialsSection
            initialMaterials={materials}
            suppliers={suppliers}
            flavors={flavors}
            packagings={packagings}
            capabilities={capabilities}
            labels={labels}
          />
        )}
        {tab === "purchaseOrders" && (
          <PurchaseOrdersSection
            materials={materials}
            suppliers={suppliers}
            capabilities={capabilities}
            labels={labels}
            onStockReceived={() => {
              refreshSummary();
              refreshLots();
            }}
          />
        )}
        {tab === "lots" && (
          <LotsSection
            initialLots={lots}
            capabilities={capabilities}
            labels={labels}
          />
        )}
        {tab === "movements" && (
          <MovementsSection
            initialMovements={initialMovements}
            materials={materials.filter((m) => m.isActive)}
            releasedLots={releasedLots}
            capabilities={capabilities}
            labels={labels}
            onMaterialUpdated={handleMaterialUpdated}
            onLotsRefresh={refreshLots}
          />
        )}
        {tab === "finished" && (
          <FinishedGoodsSection
            initialRows={finishedRows}
            initialMatrix={finishedMatrix}
            initialSummary={finishedSummary}
            initialReservations={finishedReservations}
            reserveOrders={reserveOrders}
            canEdit={capabilities.canEdit}
            labels={labels}
          />
        )}
        {tab === "separated" && (
          <SeparatedStockSection
            initialRows={separatedRows}
            sourceLots={finishedRows}
            canEdit={capabilities.canEdit}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
