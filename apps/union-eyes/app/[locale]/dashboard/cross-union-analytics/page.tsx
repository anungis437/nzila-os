/**
 * Cross-Union Analytics Page (server wrapper)
 * Auth-gated — delegates to CrossUnionAnalyticsConsole client component
 */

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import CrossUnionAnalyticsConsole from "@/components/cross-union-analytics/cross-union-analytics-console";

export const dynamic = "force-dynamic";

export default async function CrossUnionAnalyticsPage() {
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  return <CrossUnionAnalyticsConsole />;
}
