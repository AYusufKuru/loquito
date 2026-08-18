import { LogoutButton } from "@/components/logout-button";
import { PageTitle } from "@/components/app-shell/page-title";
import { LanguageSwitcher } from "@/components/locale/language-switcher";
import { t, type Locale } from "@/lib/i18n";
import type { SessionPayload } from "@/lib/auth";

interface AppHeaderProps {
  session: SessionPayload;
  locale: Locale;
  localeLabels: Record<string, string>;
}

export function AppHeader({ session, locale, localeLabels }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 lg:px-6">
      <h1 className="text-base font-semibold tracking-tight lg:text-lg">
        <PageTitle locale={locale} />
      </h1>

      <div className="flex items-center gap-3">
        <LanguageSwitcher currentLocale={locale} labels={localeLabels} />
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {session.roleName}
        </span>
        <LogoutButton label={t("app.logout", locale)} />
      </div>
    </header>
  );
}
