"use client";

import { apiFetch } from "@/lib/http";

import { useState } from "react";

import type { Locale } from "@/lib/i18n";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  labels: Record<string, string>;
}

export function LanguageSwitcher({
  currentLocale,
  labels,
}: LanguageSwitcherProps) {
  const [loading, setLoading] = useState(false);

  const change = async (locale: Locale) => {
    if (locale === currentLocale || loading) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) throw new Error("locale failed");
      window.location.reload();
    } catch {
      setLoading(false);
    }
  };

  const options: { value: Locale; label: string }[] = [
    { value: "tr", label: labels.tr },
    { value: "en", label: labels.en },
    { value: "pt", label: labels.pt },
  ];

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">
        {labels.language}
      </span>
      <select
        value={currentLocale}
        disabled={loading}
        onChange={(e) => change(e.target.value as Locale)}
        className="rounded-md border bg-background px-2 py-1 text-sm"
        aria-label={labels.language}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
