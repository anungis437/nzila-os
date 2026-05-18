/**
 * Dashboard Analytics layout — server-side auth guard for all /dashboard/analytics/* pages.
 * Requires authenticated user with at least 'steward' role (level 50).
 *
 * Analytics data includes case metrics, member engagement trends, and grievance
 * outcome statistics. Accessible to stewards and above.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardAnalyticsLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("steward");
  return <>{children}</>;
}
