import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/app/login/login-form";
import { LanguageSwitcher } from "@/components/locale/language-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDefaultRoute, getRolePermissions, getSession } from "@/lib/auth";
import {
  createTranslator,
  getLocale,
  setServerLocale,
  t,
} from "@/lib/i18n";

export default async function LoginPage() {
  const locale = await getLocale();
  setServerLocale(locale);

  const session = await getSession();
  if (session) {
    const permissions = await getRolePermissions(session.roleId);
    redirect(getDefaultRoute(permissions));
  }

  const tr = createTranslator(locale);
  const localeLabels = {
    language: tr("locale.language"),
    tr: tr("locale.tr"),
    en: tr("locale.en"),
    pt: tr("locale.pt"),
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-2xl font-bold">L</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("app.name", locale)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("app.loginSubtitle", locale)}
          </p>
          <div className="mt-4 flex justify-center">
            <LanguageSwitcher currentLocale={locale} labels={localeLabels} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("app.loginTitle", locale)}</CardTitle>
            <CardDescription>{t("app.loginDescription", locale)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <p className="text-sm text-muted-foreground">
                  {t("app.loginLoading", locale)}
                </p>
              }
            >
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("app.loginHint", locale)}
        </p>
      </div>
    </div>
  );
}
