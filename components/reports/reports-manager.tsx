"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { ChartsSection } from "./charts-section";
import { MaterialsSection } from "./materials-section";
import { ProfitabilitySection } from "./profitability-section";
import { ScrapSection } from "./scrap-section";

type Tab = "profitability" | "materials" | "scrap" | "charts";

interface ReportsManagerProps {
  initialMonth: string;
  labels: Record<string, string>;
}

export function ReportsManager({ initialMonth, labels }: ReportsManagerProps) {
  const [tab, setTab] = useState<Tab>("profitability");

  const tabs: { id: Tab; label: string }[] = [
    { id: "profitability", label: labels.profitabilityTab },
    { id: "materials", label: labels.materialsTab },
    { id: "scrap", label: labels.scrapTab },
    { id: "charts", label: labels.chartsTab },
  ];

  return (
    <div>
      <div className="flex gap-2 border-b">
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
        {tab === "profitability" && (
          <ProfitabilitySection initialMonth={initialMonth} labels={labels} />
        )}
        {tab === "materials" && (
          <MaterialsSection initialMonth={initialMonth} labels={labels} />
        )}
        {tab === "scrap" && (
          <ScrapSection initialMonth={initialMonth} labels={labels} />
        )}
        {tab === "charts" && (
          <ChartsSection initialMonth={initialMonth} labels={labels} />
        )}
      </div>
    </div>
  );
}
