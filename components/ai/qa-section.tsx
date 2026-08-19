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
import type { QaResponse } from "@/lib/ai/qa/types";

interface QaSectionProps {
  labels: Record<string, string>;
}

interface HistoryItem {
  question: string;
  response: QaResponse;
}

export function QaSection({ labels }: QaSectionProps) {
  const [samples, setSamples] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadSamples = useCallback(async () => {
    try {
      const res = await apiFetch("/api/ai/qa");
      if (!res.ok) return;
      const data = await res.json();
      setSamples(data.samples ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setInput("");

    try {
      const res = await apiFetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setHistory((prev) => [{ question: q, response: data.response }, ...prev]);
    } catch {
      setError(labels.askError);
      setInput(q);
    } finally {
      setLoading(false);
    }
  };

  const latest = history[0]?.response;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={labels.placeholder}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? labels.loading : labels.ask}
            </Button>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {labels.sampleQuestions}
            </p>
            <div className="flex flex-wrap gap-2">
              {(samples.length > 0 ? samples : []).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  disabled={loading}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-muted/60 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {latest && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{labels.answerTitle}</CardTitle>
              {latest.matched && latest.intentId && (
                <Badge variant="secondary" className="text-xs">
                  {labels.intent}: {latest.intentId}
                </Badge>
              )}
              {latest.confidence > 0 && (
                <Badge variant="outline" className="text-xs">
                  {labels.confidence}: {(latest.confidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
            <CardDescription className="font-medium text-foreground">
              {latest.question}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold">{latest.answer}</p>
            {latest.primaryValue && (
              <p className="text-sm text-muted-foreground">
                {labels.primaryValue}: <strong className="text-foreground">{latest.primaryValue}</strong>
              </p>
            )}

            {latest.sources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {labels.sourcesTitle}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {latest.sources.map((row) => (
                    <div
                      key={`${row.label}-${row.value}`}
                      className="rounded-md border bg-muted/20 px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="text-sm font-medium break-words">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latest.moduleHref && (
              <Link href={latest.moduleHref} className="text-sm text-primary underline">
                {labels.viewModule}
              </Link>
            )}

            {!latest.matched && latest.samples.length > 0 && (
              <p className="text-sm text-muted-foreground">{labels.trySamples}</p>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.historyTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {history.slice(1, 6).map((item, i) => (
                <li key={i} className="rounded-md border p-3">
                  <p className="font-medium">{item.question}</p>
                  <p className="text-muted-foreground mt-1">{item.response.answer}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{labels.disclaimer}</p>
    </div>
  );
}
