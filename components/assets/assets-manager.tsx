"use client";

import { useState } from "react";

import { InventorySection } from "@/components/assets/inventory-section";
import { PurchaseRequestsSection } from "@/components/assets/purchase-requests-section";
import { cn } from "@/lib/utils";
import type { AssetRow, PurchaseRequestRow, PurchaseSummary } from "@/lib/assets/types";

type Tab = "requests" | "inventory";

interface AssetsManagerProps {
  initialAssets: AssetRow[];
  initialTotalValueCents: number;
  initialRequests: PurchaseRequestRow[];
  initialSummary: PurchaseSummary;
  suppliers: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  labels: Record<string, string>;
}

export function AssetsManager({
  initialAssets,
  initialTotalValueCents,
  initialRequests,
  initialSummary,
  suppliers,
  canCreate,
  canEdit,
  canDelete,
  labels,
}: AssetsManagerProps) {
  const [tab, setTab] = useState<Tab>("requests");

  const tabs: { id: Tab; label: string }[] = [
    { id: "requests", label: labels.requestsTab },
    { id: "inventory", label: labels.inventoryTab },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "requests" && (
          <PurchaseRequestsSection
            initialRequests={initialRequests}
            initialSummary={initialSummary}
            suppliers={suppliers}
            canCreate={canCreate}
            canEdit={canEdit}
            labels={labels}
          />
        )}
        {tab === "inventory" && (
          <InventorySection
            initialAssets={initialAssets}
            initialTotalValueCents={initialTotalValueCents}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
