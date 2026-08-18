"use client";

import { useState } from "react";
import { CalendarRange, ClipboardList, Radio } from "lucide-react";

import { ProductionLiveBoard } from "@/components/production/production-live-board";
import { ProductionOrdersSection } from "@/components/production/production-orders-section";
import { ProductionPlanningPanel } from "@/components/production/production-planning-panel";
import { ModuleTabs } from "@/components/ui/module-tabs";
import type { SerializedProductionOrder } from "@/lib/production/serialize";

interface LineOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface PlanOrderOption {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
  deliveryDate: string | null;
}

interface ProductionManagerProps {
  planOrders: PlanOrderOption[];
  productionOrders: SerializedProductionOrder[];
  lines: LineOption[];
  canEdit: boolean;
  labels: Record<string, string>;
}

type Tab = "orders" | "live" | "planning";

export function ProductionManager({
  planOrders,
  productionOrders,
  lines,
  canEdit,
  labels,
}: ProductionManagerProps) {
  const [tab, setTab] = useState<Tab>("orders");

  const tabs = [
    { id: "orders", label: labels.ordersTab, icon: ClipboardList },
    { id: "live", label: labels.liveTab, icon: Radio },
    { id: "planning", label: labels.planningTab, icon: CalendarRange },
  ] as const;

  return (
    <div className="space-y-6">
      <ModuleTabs
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div>
        {tab === "orders" && (
          <ProductionOrdersSection
            initialOrders={productionOrders}
            lines={lines}
            canEdit={canEdit}
            labels={labels}
          />
        )}

        {tab === "live" && (
          <ProductionLiveBoard canEdit={canEdit} labels={labels} />
        )}

        {tab === "planning" && (
          <ProductionPlanningPanel orders={planOrders} labels={labels} />
        )}
      </div>
    </div>
  );
}
