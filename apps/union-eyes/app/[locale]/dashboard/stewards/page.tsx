export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { logger } from '@/lib/logger';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { isUuid } from '@/lib/page-data/uuid';
import { loadStewardsDashboard } from '@/lib/stewards/dashboard-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Union Representative Dashboard | UnionEyes",
  description: "Union representative supervision and case management tools",
};

export default async function StewardsDashboardPage() {
  const t = await getTranslations("stewardsDashboardPage");
  const user = await requireUser();
  // R9 hardening: canonical resolver only — no `|| user.organizationId`
  // fallback. user.organizationId may carry an Entra group GUID that never
  // matches an app-level org UUID; relying on it would silently fail to a
  // value that produces zero-row downstream queries instead of an honest
  // no-org redirect. See docs/nzila-residual-closure/r9-org-resolver-callsite-audit.md.
  const orgId = await getOrganizationIdForUser(user.userId);

  // Require chief_steward level (70) to access
  const hasAccess = await hasMinRole("chief_steward");

  if (!hasAccess) {
    redirect("/dashboard");
  }

  if (!isUuid(orgId)) {
    logger.warn('[StewardsDashboard] Missing organization context for user', {
      userId: user.userId,
    });
    return redirect('/dashboard');
  }

  // Read inside the organization's own transaction; a database failure reaches the error boundary instead of rendering zeros.
  const { stats: stewardStats, workload, escalations } = await loadStewardsDashboard(orgId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("pageSubtitle")}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stewardsLabel")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.totalStewards}</div>
            <p className="text-xs text-muted-foreground">{t("activeStewards")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activeCases")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.activeCases}</div>
            <p className="text-xs text-muted-foreground">{t("inProgress")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("escalations")}</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.pendingEscalations}</div>
            <p className="text-xs text-amber-500">{t("requireReview")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("completed")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.completedThisMonth}</div>
            <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("successRate")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Content Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Steward Workload & Wellbeing */}
        <Card>
          <CardHeader>
            <CardTitle>{t("stewardWorkloadTitle")}</CardTitle>
            <CardDescription>{t("stewardWorkloadDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workload.map((steward, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{steward.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("activeCasesLabel", { count: steward.active })}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700">
                    {t("capacityFreeLabel", { percent: steward.capacityFreePercent })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Escalations */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pendingEscalations")}</CardTitle>
            <CardDescription>{t("pendingEscalationsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {escalations.map((escalation, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{escalation.id}</Badge>
                    <Badge variant="secondary" className="text-amber-700">{t("escalatedBadge")}</Badge>
                  </div>
                  <div>
                    <div className="font-medium">{t("memberLabel", { name: escalation.member })}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("stewardLabel", { name: escalation.steward })}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {escalation.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
