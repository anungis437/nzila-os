/**
 * Dashboard Governance Center layout — server-side auth guard for all /dashboard/governance-center/* pages.
 * Requires authenticated user with at least 'officer' role (level 80).
 *
 * The governance center provides consolidated views of organizational governance
 * activities, board tracking, and institutional decision records.
 * Restricted to union officers and above.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardGovernanceCenterLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("officer");
  return <>{children}</>;
}
