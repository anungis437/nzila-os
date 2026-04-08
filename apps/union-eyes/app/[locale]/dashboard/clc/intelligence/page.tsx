/**
 * CLC Labour Intelligence Page (server wrapper)
 * Auth-gated — requires VIEW_CONGRESS_ANALYTICS permission.
 */

import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import CLCIntelligenceConsole from "@/components/clc/clc-intelligence-console";

export const dynamic = "force-dynamic";

export default async function CLCIntelligencePage() {
  const user = await requireUser();
  const hasAccess = user.permissions.includes("view_congress_analytics");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  return <CLCIntelligenceConsole />;
}
