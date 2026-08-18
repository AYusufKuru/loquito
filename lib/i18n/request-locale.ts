import { DEFAULT_LOCALE, type Locale } from "./locale";

let serverLocale: Locale = DEFAULT_LOCALE;

export function setServerLocale(locale: Locale): void {
  serverLocale = locale;
}

export function getServerLocale(): Locale {
  return serverLocale;
}
