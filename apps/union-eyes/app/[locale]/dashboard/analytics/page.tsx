/**
 * Analytics Overview Page (server wrapper)
 * Auth-gated — delegates to AnalyticsOverviewConsole client component
 */

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { AnalyticsOverviewConsole } from "@/components/analytics/analytics-overview-console";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  return <AnalyticsOverviewConsole />;
}
