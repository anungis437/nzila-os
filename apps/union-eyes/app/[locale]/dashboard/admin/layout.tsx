/**
 * Dashboard Admin layout — server-side auth guard for all /dashboard/admin/* pages.
 * Requires authenticated user with at least 'admin' role.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardAdminLayout({ children }: { children: ReactNode }) {
  await requireUser();

  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
