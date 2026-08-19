import { redirect } from "next/navigation";

import { HomePage } from "@/components/home-page";
import { getSession } from "@/lib/auth/session";
import { getDefaultRoute, getRolePermissions } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Page() {
  const session = await getSession();

  if (session) {
    const permissions = await getRolePermissions(session.roleId);
    redirect(getDefaultRoute(permissions));
  }

  return <HomePage />;
}
