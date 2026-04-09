"use client";

/**
 * IntelligenceShell — tabbed research / analysis surface.
 *
 * Tabs:
 *   Local        → AnalyticsOverviewConsole (local union analytics)
 *   Federation   → AI forecasts & insights (officer+)
 *   Executive    → Executive dashboard + strategic planning (secretary_treasurer+)
 *
 * Tab visibility is driven by userRole so lower-tier users only see tabs
 * they can access.  The ?scope= query param pre-selects a tab.
 */

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnalyticsOverviewConsole } from "@/components/analytics/analytics-overview-console";
import { InsightsPanel } from "@/components/analytics/insights-panel";
import ExecutiveDashboard from "@/components/executive/ExecutiveDashboard";
import StrategicPlanningBoard from "@/components/executive/StrategicPlanningBoard";
import { useOrganization } from "@/contexts/organization-context";

// Roles that can see officer-level federation insights tab
const AI_INSIGHT_ROLES = new Set([
  "officer", "president", "vice_president", "secretary_treasurer",
  "national_officer", "admin", "system_admin", "app_owner",
]);

// Roles that can see executive tab
const EXEC_ROLES = new Set([
  "president", "vice_president", "secretary_treasurer",
  "national_officer", "admin", "system_admin", "app_owner",
]);

interface IntelligenceShellProps {
  userRole: string;
}

export function IntelligenceShell({ userRole }: IntelligenceShellProps) {
  const t = useTranslations();
  const params = useSearchParams();
  const { organizationId } = useOrganization();

  const canSeeAI = AI_INSIGHT_ROLES.has(userRole);
  const canSeeExec = EXEC_ROLES.has(userRole);

  // Resolve default tab from ?scope= query param
  const scope = params.get("scope");
  let defaultTab = "local";
  if (scope === "federation" && canSeeAI) defaultTab = "federation";
  if (scope === "executive" && canSeeExec) defaultTab = "executive";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.intelligence")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Research, analysis, and insights — understand trends and make informed decisions.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          <TabsTrigger value="local">{t("sidebar.insights")}</TabsTrigger>
          {canSeeAI && (
            <TabsTrigger value="federation">{t("sidebar.federation")}</TabsTrigger>
          )}
          {canSeeExec && (
            <TabsTrigger value="executive">Executive</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="local" className="mt-4">
          <AnalyticsOverviewConsole />
        </TabsContent>

        {canSeeAI && (
          <TabsContent value="federation" className="mt-4">
            <InsightsPanel insights={[]} />
          </TabsContent>
        )}

        {canSeeExec && (
          <TabsContent value="executive" className="mt-4">
            <div className="space-y-8">
              <ExecutiveDashboard
                organizationId={organizationId ?? "default"}
                userRole={userRole}
              />
              <StrategicPlanningBoard />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
