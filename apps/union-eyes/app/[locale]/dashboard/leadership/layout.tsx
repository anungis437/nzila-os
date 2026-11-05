import { ReactNode } from "react";
import { requireDashboardAccess } from "@/lib/dashboard/require-dashboard-access";

/**
 * Leadership (member-service oversight) layout — server-side guard.
 * The page is a client component with no guard of its own; the aggregates it
 * reads are served only to officer and above (/api/dashboard/leadership).
 */
export default async function LeadershipLayout({ children }: { children: ReactNode }) {
  await requireDashboardAccess("officer");
  return <>{children}</>;
}
