/**
 * Dashboard Admin layout — server-side auth guard for all /dashboard/admin/* pages.
 * Requires authenticated user with at least 'officer' role.
 * Secretary-Treasurer (110) and above can access admin pages like Dues Admin.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardAdminLayout({ children }: { children: ReactNode }) {
  await requireUser();

  const hasAccess = await hasMinRole("officer");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
