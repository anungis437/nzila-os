export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { db } from '@/db/db';
import { stewards, grievances } from '@/db/schema';
import { organizationMembers } from '@/db/schema-organizations';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, AlertCircle, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Chief Steward Dashboard | UnionEyes",
  description: "Steward supervision and case management tools",
};

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause ? String(error.cause) : undefined,
      stack: error.stack,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      raw: String(error),
      name: typeof record.name === 'string' ? record.name : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
      code: typeof record.code === 'string' ? record.code : undefined,
      severity: typeof record.severity === 'string' ? record.severity : undefined,
      detail: typeof record.detail === 'string' ? record.detail : undefined,
      hint: typeof record.hint === 'string' ? record.hint : undefined,
      where: typeof record.where === 'string' ? record.where : undefined,
      schema: typeof record.schema === 'string' ? record.schema : undefined,
      table: typeof record.table === 'string' ? record.table : undefined,
      column: typeof record.column === 'string' ? record.column : undefined,
      constraint: typeof record.constraint === 'string' ? record.constraint : undefined,
    };
  }

  return { raw: String(error) };
}

export default async function StewardsDashboardPage() {
  const t = await getTranslations("stewardsDashboardPage");
  const user = await requireUser();
  const resolvedOrgId = await getOrganizationIdForUser(user.userId);
  const orgId = resolvedOrgId || user.organizationId;
  logger.info('[TEMP][StewardsDashboard] Page load start', {
    userId: user.userId,
    organizationId: orgId,
    requireUserOrganizationId: user.organizationId,
    resolvedOrganizationId: resolvedOrgId,
    roles: user.roles,
  });

  if (resolvedOrgId && user.organizationId !== resolvedOrgId) {
    logger.warn('[TEMP][StewardsDashboard] Organization mismatch detected', {
      userId: user.userId,
      requireUserOrganizationId: user.organizationId,
      resolvedOrganizationId: resolvedOrgId,
    });
  }

  // Require chief_steward level (70) to access
  const hasAccess = await hasMinRole("chief_steward");

  if (!hasAccess) {
    redirect("/dashboard");
  }

  if (!orgId) {
    logger.warn('[StewardsDashboard] Missing organization context for user', {
      userId: user.userId,
    });
    return redirect('/dashboard');
  }

  // Direct DB queries — org-scoped to user's organization
  let stewardStats = { totalStewards: 0, activeCases: 0, pendingEscalations: 0, completedThisMonth: 0, successRate: 0, upcomingTraining: 0 };
  let stewardPerformance: { name: string; active: number; completed: number; successRate: number }[] = [];
  let pendingEscalationsList: { id: string; member: string; steward: string; reason: string }[] = [];

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartIso = monthStart.toISOString();
    // Use only statuses present in the live PostgreSQL grievance_status enum.
    const terminalStatuses = `'closed', 'settled', 'withdrawn', 'denied'`;

    // --- Stats ---
    const [
      totalStewards,
      activeCaseloadResult,
      pendingEscalations,
      completedThisMonthResult,
      totalClosedResult,
      totalGrievancesResult,
    ] = await Promise.all([
      // Count active stewards for this org
      db.select({ count: sql<number>`count(*)::int` })
        .from(stewards)
        .where(sql`active = true AND org_id = ${orgId}::uuid`)
        .then(r => r[0]?.count ?? 0),
      // Sum current caseloads for this org's stewards
      db.select({ total: sql<number>`coalesce(sum(current_caseload), 0)::int` })
        .from(stewards)
        .where(sql`active = true AND org_id = ${orgId}::uuid`)
        .then(r => r[0]?.total ?? 0),
      // Count escalated grievances (no org column — filter by org members' grievances)
      db.select({ count: sql<number>`count(*)::int` })
        .from(grievances)
        .where(sql`${grievances.status} = 'escalated' AND ${grievances.organizationId} = ${orgId}::uuid`)
        .then(r => r[0]?.count ?? 0),
      // Grievances closed/resolved this month
      db.select({ count: sql<number>`count(*)::int` })
        .from(grievances)
        .where(sql`${grievances.organizationId} = ${orgId}::uuid AND ${grievances.status} IN (${sql.raw(terminalStatuses)}) AND coalesce(${grievances.closedAt}, ${grievances.resolvedAt}) >= ${monthStartIso}::timestamptz`)
        .then(r => r[0]?.count ?? 0),
      // Total closed/resolved (for success rate)
      db.select({ count: sql<number>`count(*)::int` })
        .from(grievances)
        .where(sql`${grievances.organizationId} = ${orgId}::uuid AND ${grievances.status} IN (${sql.raw(terminalStatuses)})`)
        .then(r => r[0]?.count ?? 0),
      // Total grievances filed (excluding drafts)
      db.select({ count: sql<number>`count(*)::int` })
        .from(grievances)
        .where(sql`${grievances.organizationId} = ${orgId}::uuid AND ${grievances.status} != 'draft'`)
        .then(r => r[0]?.count ?? 0),
    ]);

    const successRate = totalGrievancesResult > 0
      ? Math.round((totalClosedResult / totalGrievancesResult) * 100)
      : 0;

    const stats = {
      totalStewards,
      activeCases: activeCaseloadResult,
      pendingEscalations,
      completedThisMonth: completedThisMonthResult,
      successRate,
      upcomingTraining: 0,
    };

    logger.info('[TEMP][StewardsDashboard] Stats query results', {
      organizationId: orgId,
      totalStewards,
      activeCaseloadResult,
      pendingEscalations,
      completedThisMonthResult,
      totalClosedResult,
      totalGrievancesResult,
      successRate,
    });

    // --- Per-steward workload ---
    // stewards.userId is a UUID that may match organization_members.id or organization_members.userId
    // Filter by org, then look up display names from organization_members by userId
    logger.info('[TEMP][StewardsDashboard] Loading steward workload rows', {
      organizationId: orgId,
    });

    const stewardRows = await db
      .select({
        stewardId: stewards.id,
        userId: stewards.userId,
        active: stewards.currentCaseload,
        maxCaseload: stewards.maxCaseload,
      })
      .from(stewards)
      .where(sql`active = true AND org_id = ${orgId}::uuid`)
      .orderBy(sql`current_caseload DESC`);

    logger.info('[TEMP][StewardsDashboard] Steward workload rows loaded', {
      organizationId: orgId,
      stewardRowCount: stewardRows.length,
      stewardUserIds: stewardRows.map((row) => row.userId),
    });

    let performance: { name: string; active: number; completed: number; successRate: number }[] = [];
    if (stewardRows.length > 0) {
      logger.info('[TEMP][StewardsDashboard] Loading org members for steward name map', {
        organizationId: orgId,
      });

      const orgMembers = await db
        .select({ id: organizationMembers.id, userId: organizationMembers.userId, name: organizationMembers.name })
        .from(organizationMembers)
        .where(sql`${organizationMembers.organizationId} = ${orgId}`);

      logger.info('[TEMP][StewardsDashboard] Org members loaded for steward name map', {
        organizationId: orgId,
        orgMemberCount: orgMembers.length,
      });

      const nameMap = new Map<string, string>();
      orgMembers.forEach((member) => {
        if (member.id) {
          nameMap.set(member.id, member.name ?? 'Unknown');
        }
        if (member.userId) {
          nameMap.set(member.userId, member.name ?? 'Unknown');
        }
      });
      performance = stewardRows.map(r => ({
        name: nameMap.get(r.userId) ?? 'Unknown',
        active: r.active,
        completed: 0,
        successRate: r.maxCaseload > 0
          ? Math.round(((r.maxCaseload - r.active) / r.maxCaseload) * 100)
          : 0,
      }));

      logger.info('[TEMP][StewardsDashboard] Steward workload mapping', {
        organizationId: orgId,
        stewardRowCount: stewardRows.length,
        orgMemberCount: orgMembers.length,
        unresolvedStewardUserIds: stewardRows
          .map((row) => row.userId)
          .filter((userId) => !nameMap.has(userId)),
      });
    }

    // --- Escalations ---
    logger.info('[TEMP][StewardsDashboard] Loading escalations list', {
      organizationId: orgId,
    });

    const escRows = await db
      .select({
        grievanceId: grievances.id,
        grievanceNumber: grievances.grievanceNumber,
        grievantName: grievances.grievantName,
        title: grievances.title,
      })
      .from(grievances)
      .where(sql`${grievances.status} = 'escalated' AND ${grievances.organizationId} = ${orgId}::uuid`)
      .orderBy(grievances.escalatedAt)
      .limit(50);

    logger.info('[TEMP][StewardsDashboard] Escalations list loaded', {
      organizationId: orgId,
      escalationRowCount: escRows.length,
    });

    const escalations = escRows.map(r => ({
      id: r.grievanceNumber ?? r.grievanceId,
      member: r.grievantName ?? 'Unknown',
      steward: 'Pending Assignment',
      reason: r.title ?? '',
    }));

    stewardStats = stats;
    stewardPerformance = performance;
    pendingEscalationsList = escalations;

    logger.info('[TEMP][StewardsDashboard] Render payload ready', {
      organizationId: orgId,
      stewardStats,
      stewardPerformanceCount: stewardPerformance.length,
      pendingEscalationsCount: pendingEscalationsList.length,
    });
  } catch (error) {
    logger.error('[StewardsDashboard] DB query failed:', {
      organizationId: orgId,
      error: serializeUnknownError(error),
    });
    // Fall through with empty defaults
  }

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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
            <p className="text-xs text-green-500">{t("successRateTrend")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("training")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.upcomingTraining}</div>
            <p className="text-xs text-muted-foreground">{t("upcomingSessions")}</p>
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
              {stewardPerformance.map((steward, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{steward.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("activeCasesLabel", { count: steward.active })}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700">
                    {t("capacityFreeLabel", { percent: steward.successRate })}
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
              {pendingEscalationsList.map((escalation, idx) => (
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
