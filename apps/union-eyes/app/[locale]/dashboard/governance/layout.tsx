/**
 * Dashboard Governance layout — server-side auth guard for all /dashboard/governance/* pages.
 * Requires authenticated user with at least 'steward' role.
 *
 * Governance data includes board packets, meeting records, motions, resolutions,
 * and organizational decisions. Restricted to stewards and above.
 */
import { ReactNode } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardGovernanceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }
  return <>{children}</>;
}
