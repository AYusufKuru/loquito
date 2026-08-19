import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getModuleConfig, type ModuleId } from "@/lib/modules";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const moduleId = params.module as ModuleId | undefined;
  const moduleConfig = moduleId ? getModuleConfig(moduleId) : undefined;
  const moduleLabel = moduleConfig
    ? t(moduleConfig.labelKey as Parameters<typeof t>[0])
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>{t("app.unauthorizedTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("app.unauthorized")}</p>
          {moduleLabel && (
            <p>
              Erişim reddedildi: <span className="font-medium text-foreground">{moduleLabel}</span>
            </p>
          )}
          {session && (
            <p>
              {t("app.role")}: {session.roleName}
            </p>
          )}
          <p>Sol menüden erişebildiğiniz modülleri kullanabilirsiniz.</p>
        </CardContent>
      </Card>
    </div>
  );
}
