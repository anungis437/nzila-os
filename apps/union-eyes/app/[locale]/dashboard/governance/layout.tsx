/**
 * Dashboard Governance layout — server-side auth guard for all /dashboard/governance/* pages.
 * Requires authenticated user with at least 'officer' role (level 80).
 *
 * Governance data includes board packets, meeting records, motions, resolutions,
 * and organizational decisions. Restricted to union officers and above.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardGovernanceLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("officer");
  return <>{children}</>;
}
