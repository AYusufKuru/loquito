import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { getModuleConfig, type ModuleId } from "@/lib/modules";

interface ModuleShellProps {
  moduleId: ModuleId;
}

export function ModuleShell({ moduleId }: ModuleShellProps) {
  const config = getModuleConfig(moduleId);
  if (!config) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mt-0">
        <CardHeader>
          <CardTitle className="text-base">{t("app.comingSoon")}</CardTitle>
          <CardDescription>
            {config.id} modülü sonraki geliştirme adımlarında tamamlanacak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30">
            <config.icon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
