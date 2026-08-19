"use client";

import { apiFetch } from "@/lib/http";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AiRecommendation,
  AiRecommendationsReport,
  RecommendationCategory,
} from "@/lib/ai/recommendations/types";
import { cn } from "@/lib/utils";

interface RecommendationsSectionProps {
  labels: Record<string, string>;
}

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const CATEGORY_KEYS: RecommendationCategory[] = [
  "profitability",
  "stock_level",
  "purchase",
  "demand_forecast",
  "anomaly",
];

function categoryLabel(labels: Record<string, string>, category: RecommendationCategory) {
  return labels[`category_${category}`] ?? category;
}

export function RecommendationsSection({ labels }: RecommendationsSectionProps) {
  const [report, setReport] = useState<AiRecommendationsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<RecommendationCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/ai/recommendations");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setReport(data.report);
    } catch {
      setError(labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const items: AiRecommendation[] =
    filter === "all"
      ? report?.recommendations ?? []
      : (report?.recommendations ?? []).filter((r) => r.category === filter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{labels.title}</CardTitle>
            <CardDescription>{labels.desc}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {labels.refresh}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {report && (
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>
                {labels.period}: <strong className="text-foreground">{report.periodLabel}</strong>
              </span>
              <span>·</span>
              <span>
                {labels.totalCount}: <strong className="text-foreground">{report.totalCount}</strong>
              </span>
              <span>·</span>
              <span>
                {labels.anchor}: {report.anchorDate}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                filter === "all"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {labels.filterAll}
              {report ? ` (${report.totalCount})` : ""}
            </button>
            {CATEGORY_KEYS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                  filter === cat
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {categoryLabel(labels, cat)}
                {report ? ` (${report.byCategory[cat]})` : ""}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && !report && (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          )}

          {!loading && items.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">{labels.noItems}</p>
          )}

          <ul className="space-y-3">
            {items.map((item) => {
              const isOpen = expanded === item.id;
              return (
                <li
                  key={item.id}
                  className="rounded-lg border bg-card text-card-foreground"
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 p-4 text-left"
                    onClick={() => setExpanded(isOpen ? null : item.id)}
                  >
                    <Badge variant={SEVERITY_VARIANT[item.severity]}>
                      {labels[`severity_${item.severity}`]}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabel(labels, item.category)}
                        </Badge>
                        {item.metrics.slice(0, 3).map((m) => (
                          <span
                            key={m.label}
                            className="text-xs text-muted-foreground"
                          >
                            {m.label}: {m.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t px-4 pb-4 pt-3 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {labels.reasoning}
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
                          {item.reasoning.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>

                      {item.metrics.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {item.metrics.map((m) => (
                            <div
                              key={m.label}
                              className="rounded-md border bg-muted/30 px-3 py-2"
                            >
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                              <p className="text-sm font-medium">{m.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.suggestedAction && (
                        <p className="text-sm">
                          <span className="font-medium">{labels.suggestedAction}: </span>
                          {item.suggestedAction}
                        </p>
                      )}

                      {item.href && (
                        <Link
                          href={item.href}
                          className="text-sm text-primary underline"
                        >
                          {labels.viewModule}
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted-foreground border-t pt-3">
            {labels.disclaimer}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
