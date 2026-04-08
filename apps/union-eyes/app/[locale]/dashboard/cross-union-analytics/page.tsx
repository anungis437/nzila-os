/**
 * Cross-Union Analytics Page (server wrapper)
 * Auth-gated — requires VIEW_CROSS_UNION_ANALYTICS permission.
 * Delegates to CrossUnionAnalyticsConsole client component.
 */

import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import CrossUnionAnalyticsConsole from "@/components/cross-union-analytics/cross-union-analytics-console";

export const dynamic = "force-dynamic";

export default async function CrossUnionAnalyticsPage() {
  const user = await requireUser();
  const hasAccess = user.permissions.includes("view_cross_union_analytics");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  return <CrossUnionAnalyticsConsole />;
}
