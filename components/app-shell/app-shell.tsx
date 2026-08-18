import Link from "next/link";

import { AppHeader } from "@/components/app-shell/app-header";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import type { PermissionMap, SessionPayload } from "@/lib/auth";
import { getVisibleModules } from "@/lib/auth/permissions";
import { t, type Locale } from "@/lib/i18n";
import { MODULE_CONFIG } from "@/lib/modules";

interface AppShellProps {
  session: SessionPayload;
  permissions: PermissionMap;
  locale: Locale;
  children: React.ReactNode;
}

export function AppShell({ session, permissions, locale, children }: AppShellProps) {
  const visibleIds = getVisibleModules(permissions);

  const labels: Record<string, string> = {};
  for (const mod of MODULE_CONFIG) {
    labels[mod.labelKey] = t(mod.labelKey as Parameters<typeof t>[0], locale);
  }

  const localeLabels = {
    language: t("locale.language", locale),
    tr: t("locale.tr", locale),
    en: t("locale.en", locale),
    pt: t("locale.pt", locale),
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">L</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{t("app.name", locale)}</p>
            <p className="text-xs text-muted-foreground">{t("app.subtitle", locale)}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav moduleIds={visibleIds} labels={labels} />
        </div>
        <div className="shrink-0 border-t p-3">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← {t("app.home", locale)}
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader session={session} locale={locale} localeLabels={localeLabels} />
        <div className="shrink-0 border-b bg-card lg:hidden overflow-x-auto">
          <SidebarNav moduleIds={visibleIds} labels={labels} orientation="horizontal" />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
