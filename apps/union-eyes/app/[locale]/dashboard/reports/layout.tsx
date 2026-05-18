/**
 * Dashboard Reports layout — server-side auth guard for all /dashboard/reports/* pages.
 * Requires authenticated user with at least 'steward' role (level 50).
 *
 * Reports include case outcome summaries, dues collection reports, member activity
 * reports, and organizational health metrics. Accessible to stewards and above.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardReportsLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("steward");
  return <>{children}</>;
}
