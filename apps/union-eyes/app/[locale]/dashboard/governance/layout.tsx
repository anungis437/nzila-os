/**
 * Dashboard Governance layout — server-side auth guard for all /dashboard/governance/* pages.
 * Requires authenticated user with at least 'steward' role.
 *
 * Governance data includes board packets, meeting records, motions, resolutions,
 * and organizational decisions. Restricted to stewards and above.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardGovernanceLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("steward");
  return <>{children}</>;
}
