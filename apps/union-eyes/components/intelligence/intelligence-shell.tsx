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
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticsOverviewConsole } from "@/components/analytics/analytics-overview-console";
import { InsightsPanel } from "@/components/analytics/insights-panel";
import ExecutiveDashboard from "@/components/executive/ExecutiveDashboard";
import StrategicPlanningBoard from "@/components/executive/StrategicPlanningBoard";
import { useOrganization } from "@/contexts/organization-context";
import { Briefcase, TrendingUp, AlertCircle, BookOpen } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { ActionHint } from "@/components/onboarding/action-hint";

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
  const locale = useLocale();
  const params = useSearchParams();
  const { organizationId, organization } = useOrganization();

  // Federation tab only for congress/federation/union org types
  const isFederationOrg = ['congress', 'federation', 'union'].includes(organization?.type ?? '');
  const canSeeAI = AI_INSIGHT_ROLES.has(userRole) && isFederationOrg;
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
        <Link
          href={`/${locale}/dashboard/knowledge`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
        >
          <BookOpen size={12} /> Supporting references in Knowledge
        </Link>
        <ActionHint hintKey="intelligence-first" text="Focus on the top signals and recommended actions" />
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
            <Card className="mt-4">
              <CardContent className="py-12 text-center">
                <TrendingUp size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="font-medium text-gray-700">Federation insights are building</p>
                <p className="text-sm text-gray-400 mt-1">
                  As more data flows through the system, cross-local trends and AI-driven
                  forecasts will surface here automatically.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canSeeExec && (
          <TabsContent value="executive" className="mt-4">
            <div className="space-y-8">
              {/* Executive Briefing */}
              <Card className="border-l-4 border-l-blue-600">
                <CardContent className="py-5 px-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase size={18} className="text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-900">Executive Briefing</h2>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    This is your leadership summary. Active casework, grievance
                    trends, and upcoming deadlines are consolidated below. Strategic
                    decisions should be guided by the priorities and metrics on this page.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3 mt-4">
                    <div className="flex items-start gap-2 p-3 rounded-md bg-gray-50">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Priority 1</p>
                        <p className="text-xs text-gray-500">Review overdue grievances and escalate where needed.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-md bg-gray-50">
                      <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Priority 2</p>
                        <p className="text-xs text-gray-500">Prepare for upcoming bargaining sessions and review proposals.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-md bg-gray-50">
                      <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Priority 3</p>
                        <p className="text-xs text-gray-500">Assess resolution rate trends and member satisfaction feedback.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
