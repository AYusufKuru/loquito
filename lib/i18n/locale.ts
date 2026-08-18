export const LOCALE_COOKIE = "loquito_locale";

export const LOCALES = ["tr", "en", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export const INTL_LOCALE: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
  pt: "pt-BR",
};

export const HTML_LANG: Record<Locale, string> = {
  tr: "tr",
  en: "en",
  pt: "pt-BR",
};
