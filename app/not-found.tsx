import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createTranslator, getLocale, setServerLocale } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await getLocale();
  setServerLocale(locale);
  const tr = createTranslator(locale);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/40">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {tr("errors.notFoundTitle")}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {tr("errors.notFoundDescription")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">{tr("errors.backDashboard")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">{tr("errors.backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
