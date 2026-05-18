/**
 * Dashboard Integrations layout — server-side auth guard for all /dashboard/integrations/* pages.
 * Requires authenticated user with at least 'admin' role (level 140).
 *
 * Integration management covers third-party connections, API credentials, data
 * sync configurations, and federation service bindings. Restricted to organization
 * administrators and above due to the security and data governance implications.
 */
import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

export default async function DashboardIntegrationsLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("admin");
  return <>{children}</>;
}
