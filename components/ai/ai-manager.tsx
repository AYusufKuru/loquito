"use client";

import { useState } from "react";

import { GmailSection } from "@/components/ai/gmail-section";
import { OrderImportSection } from "@/components/ai/order-import-section";
import { QaSection } from "@/components/ai/qa-section";
import { RecommendationsSection } from "@/components/ai/recommendations-section";
import { cn } from "@/lib/utils";

type Tab = "recommendations" | "qa" | "gmail" | "ocr";

interface AiManagerProps {
  customers: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canEdit: boolean;
  ocrLabels: Record<string, string>;
  gmailLabels: Record<string, string>;
  recommendationLabels: Record<string, string>;
  qaLabels: Record<string, string>;
}

export function AiManager({
  customers,
  canCreate,
  canEdit,
  ocrLabels,
  gmailLabels,
  recommendationLabels,
  qaLabels,
}: AiManagerProps) {
  const [tab, setTab] = useState<Tab>("recommendations");

  const tabs: { id: Tab; label: string }[] = [
    { id: "recommendations", label: recommendationLabels.tabRecommendations },
    { id: "qa", label: qaLabels.tabQa },
    { id: "gmail", label: gmailLabels.tabGmail },
    { id: "ocr", label: gmailLabels.tabOcr },
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
        {tab === "recommendations" && (
          <RecommendationsSection labels={recommendationLabels} />
        )}
        {tab === "qa" && <QaSection labels={qaLabels} />}
        {tab === "gmail" && (
          <GmailSection
            canCreate={canCreate}
            canEdit={canEdit}
            labels={gmailLabels}
          />
        )}
        {tab === "ocr" && (
          <OrderImportSection
            customers={customers}
            canCreate={canCreate}
            labels={ocrLabels}
          />
        )}
      </div>
    </div>
  );
}
