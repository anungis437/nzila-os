/**
 * Dashboard Documents layout — server-side auth guard for all /dashboard/documents/* pages.
 * Requires authenticated user with at least 'officer' role (level 80).
 * Document management is restricted to union officers and above.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardDocumentsLayout({ children }: { children: ReactNode }) {
  await requireUser();

  const hasAccess = await hasMinRole("officer");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
