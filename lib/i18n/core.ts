import en from "./en.json";
import pt from "./pt.json";
import { getServerLocale } from "./request-locale";
import { tr } from "./tr";
import type { Locale } from "./locale";
import { translate, type TranslationKey, type TranslationTree } from "./types";

const dictionaries: Record<Locale, TranslationTree> = {
  tr,
  en: en as TranslationTree,
  pt: pt as TranslationTree,
};

export function t(key: TranslationKey, locale?: Locale): string {
  const active = locale ?? getServerLocale();
  return translate(key, active, dictionaries);
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey) => translate(key, locale, dictionaries);
}

export { tr } from "./tr";
export type { TranslationKey, TranslationTree } from "./types";
