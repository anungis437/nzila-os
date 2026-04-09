"use client";

/**
 * IntelligenceShell — tabbed research / analysis surface.
 *
 * Tabs:
 *   Local        → AnalyticsOverviewConsole (local union analytics)
 *   AI Insights  → AI forecasts (officer+)
 *   Executive    → Executive dashboard (secretary_treasurer+)
 *
 * Tab visibility is driven by userRole so lower-tier users only see tabs
 * they can access.  The ?scope= query param pre-selects a tab.
 */

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnalyticsOverviewConsole } from "@/components/analytics/analytics-overview-console";

// Roles that can see officer-level AI insights tab
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

  const canSeeAI = AI_INSIGHT_ROLES.has(userRole);
  const canSeeExec = EXEC_ROLES.has(userRole);

  // Resolve default tab from ?scope= query param
  const scope = params.get("scope");
  let defaultTab = "local";
  if (scope === "federation" && canSeeAI) defaultTab = "ai";
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
            <TabsTrigger value="ai">{t("sidebar.aiInsights")}</TabsTrigger>
          )}
          {canSeeExec && (
            <TabsTrigger value="executive">Executive</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="local" className="mt-4">
          <AnalyticsOverviewConsole />
        </TabsContent>

        {canSeeAI && (
          <TabsContent value="ai" className="mt-4">
            <div className="rounded-lg border p-6 text-center text-gray-500">
              <p className="font-medium mb-1">AI-powered insights</p>
              <p className="text-sm text-gray-400">
                Navigate to{" "}
                <a href="insights" className="text-blue-600 underline">
                  AI Insights
                </a>{" "}
                for detailed forecasts and analysis.
              </p>
            </div>
          </TabsContent>
        )}

        {canSeeExec && (
          <TabsContent value="executive" className="mt-4">
            <div className="rounded-lg border p-6 text-center text-gray-500">
              <p className="font-medium mb-1">Executive overview</p>
              <p className="text-sm text-gray-400">
                Navigate to{" "}
                <a href="executive" className="text-blue-600 underline">
                  Executive Dashboard
                </a>{" "}
                for strategic planning and KPIs.
              </p>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
