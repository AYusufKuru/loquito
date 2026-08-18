"use client";

import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n/locale";
import { getModuleTitleFromPath } from "@/lib/page-title";

interface PageTitleProps {
  locale: Locale;
}

export function PageTitle({ locale }: PageTitleProps) {
  const pathname = usePathname();
  return <>{getModuleTitleFromPath(pathname, locale)}</>;
}
