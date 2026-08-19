import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions } from "@/lib/auth/permissions";
import { getLocale, setServerLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const locale = await getLocale();
  setServerLocale(locale);

  const permissions = await getRolePermissions(session.roleId);

  return (
    <AppShell session={session} permissions={permissions} locale={locale}>
      {children}
    </AppShell>
  );
}
