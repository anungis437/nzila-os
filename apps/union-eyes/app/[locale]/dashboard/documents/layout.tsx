/**
 * Dashboard Documents layout — server-side auth guard for all /dashboard/documents/* pages.
 * Requires authenticated user with at least 'steward' role (level 50).
 * Documents are accessible to all union staff and above; the sidebar nav
 * includes a Documents link for stewards so this layout must permit steward access.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardDocumentsLayout({ children }: { children: ReactNode }) {
  await requireUser();

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
