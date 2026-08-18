import { t } from "@/lib/i18n/core";
import type { Locale } from "@/lib/i18n/locale";
import type { TranslationKey } from "@/lib/i18n/types";
import { MODULE_CONFIG } from "@/lib/modules";

export function getModuleTitleFromPath(pathname: string, locale: Locale): string {
  const normalized = pathname.split("?")[0].replace(/\/$/, "") || "/";
  const mod = MODULE_CONFIG.find(
    (m) => normalized === m.path || normalized.startsWith(`${m.path}/`),
  );

  if (mod) {
    return t(mod.labelKey as TranslationKey, locale);
  }

  return t("app.name", locale);
}
