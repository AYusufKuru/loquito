import type { Locale } from "./locale";

export type TranslationTree = typeof import("./tr").tr;

type Paths<T, P extends string = ""> = T extends string
  ? P
  : {
      [K in keyof T & string]: Paths<T[K], P extends "" ? K : `${P}.${K}`>;
    }[keyof T & string];

export type TranslationKey = Paths<TranslationTree>;

export function resolvePath(
  tree: Record<string, unknown>,
  key: string,
): string | undefined {
  const parts = key.split(".");
  let current: unknown = tree;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  key: TranslationKey,
  locale: Locale,
  dictionaries: Record<Locale, TranslationTree>,
): string {
  const primary = resolvePath(
    dictionaries[locale] as Record<string, unknown>,
    key,
  );
  if (primary) return primary;
  const fallback = resolvePath(
    dictionaries.tr as Record<string, unknown>,
    key,
  );
  return fallback ?? key;
}
