/**
 * Dashboard Audits layout — server-side auth guard for all /dashboard/audits/* pages.
 * Requires authenticated user with at least 'admin' role (level 140).
 *
 * Audit data includes access logs, evidence trails, change histories, and
 * governance action records. Restricted to organization administrators and above
 * due to the sensitive and compliance-relevant nature of audit information.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardAuditsLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("admin");
  return <>{children}</>;
}
