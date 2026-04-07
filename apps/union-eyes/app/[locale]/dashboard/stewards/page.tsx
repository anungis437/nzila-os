export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { db } from '@/db/db';
import { stewards, stewardAssignments, grievances, organizationMembers } from '@/db/schema';
import { sql, eq, and, gte } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, TrendingUp, AlertCircle, Calendar, Star } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chief Steward Dashboard | UnionEyes",
  description: "Steward supervision and case management tools",
};

export default async function StewardsDashboardPage() {
  const _user = await requireUser();
  
  // Require chief_steward level (70) to access
  const hasAccess = await hasMinRole("chief_steward");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Direct DB queries — avoids self-fetch auth issues
  let stewardStats = { totalStewards: 0, activeCases: 0, pendingEscalations: 0, completedThisMonth: 0, successRate: 0, upcomingTraining: 0 };
  let stewardPerformance: { name: string; active: number; completed: number; successRate: number }[] = [];
  let pendingEscalationsList: { id: string; member: string; steward: string; reason: string }[] = [];

  try {
  const result = await withSystemContext(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // --- Stats ---
    const [
      totalStewards,
      activeCases,
      pendingEscalations,
      completedThisMonth,
      totalCompleted,
      totalAssignments,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(stewards)
        .where(eq(stewards.active, true))
        .then(r => r[0]?.count ?? 0),
      db.select({ count: sql<number>`count(*)::int` })
        .from(stewardAssignments)
        .where(eq(stewardAssignments.status, 'active'))
        .then(r => r[0]?.count ?? 0),
      db.select({ count: sql<number>`count(*)::int` })
        .from(grievances)
        .where(eq(grievances.status, 'escalated'))
        .then(r => r[0]?.count ?? 0),
      db.select({ count: sql<number>`count(*)::int` })
        .from(stewardAssignments)
        .where(and(
          eq(stewardAssignments.status, 'completed'),
          gte(stewardAssignments.completedAt, monthStart),
        ))
        .then(r => r[0]?.count ?? 0),
      db.select({ count: sql<number>`count(*)::int` })
        .from(stewardAssignments)
        .where(eq(stewardAssignments.status, 'completed'))
        .then(r => r[0]?.count ?? 0),
      db.select({ count: sql<number>`count(*)::int` })
        .from(stewardAssignments)
        .where(sql`${stewardAssignments.status} NOT IN ('pending', 'declined')`)
        .then(r => r[0]?.count ?? 0),
    ]);

    const successRate = totalAssignments > 0
      ? Math.round((totalCompleted / totalAssignments) * 100)
      : 0;

    const stats = { totalStewards, activeCases, pendingEscalations, completedThisMonth, successRate, upcomingTraining: 0 };

    // --- Performance ---
    const perfRows = await db
      .select({
        stewardId: stewards.id,
        userId: stewards.userId,
        active: sql<number>`count(*) FILTER (WHERE ${stewardAssignments.status} = 'active')::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${stewardAssignments.status} = 'completed')::int`,
        total: sql<number>`count(*) FILTER (WHERE ${stewardAssignments.status} NOT IN ('pending', 'declined'))::int`,
      })
      .from(stewards)
      .leftJoin(stewardAssignments, eq(stewardAssignments.stewardId, sql`${stewards.userId}::text`))
      .where(eq(stewards.active, true))
      .groupBy(stewards.id, stewards.userId);

    let performance: { name: string; active: number; completed: number; successRate: number }[] = [];
    if (perfRows.length > 0) {
      const userIds = perfRows.map(r => r.userId);
      const members = await db
        .select({ userId: organizationMembers.userId, name: organizationMembers.name })
        .from(organizationMembers)
        .where(sql`${organizationMembers.userId}::text IN (${sql.join(userIds.map(id => sql`${id}::text`), sql`, `)})`);
      const nameMap = new Map(members.map(m => [m.userId, m.name ?? 'Unknown']));
      performance = perfRows.map(r => ({
        name: nameMap.get(r.userId) ?? 'Unknown',
        active: r.active,
        completed: r.completed,
        successRate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
      }));
    }

    // --- Escalations ---
    const escRows = await db
      .select({
        grievanceId: grievances.id,
        grievanceNumber: grievances.grievanceNumber,
        grievantName: grievances.grievantName,
        title: grievances.title,
        stewardId: stewardAssignments.stewardId,
      })
      .from(grievances)
      .leftJoin(stewardAssignments, eq(stewardAssignments.grievanceId, grievances.id))
      .where(eq(grievances.status, 'escalated'))
      .orderBy(grievances.escalatedAt)
      .limit(50);

    let escalations: { id: string; member: string; steward: string; reason: string }[] = [];
    if (escRows.length > 0) {
      const stewardIds = [...new Set(escRows.map(r => r.stewardId).filter(Boolean))] as string[];
      const stewardNameMap = new Map<string, string>();
      if (stewardIds.length > 0) {
        // stewardIds are user IDs (text) — look up names directly from organizationMembers
        const sMembers = await db
          .select({ userId: organizationMembers.userId, name: organizationMembers.name })
          .from(organizationMembers)
          .where(sql`${organizationMembers.userId}::text IN (${sql.join(stewardIds.map(id => sql`${id}`), sql`, `)})`);
        sMembers.forEach(m => stewardNameMap.set(m.userId, m.name ?? 'Unknown'));
      }
      escalations = escRows.map(r => ({
        id: r.grievanceNumber ?? r.grievanceId,
        member: r.grievantName ?? 'Unknown',
        steward: r.stewardId ? (stewardNameMap.get(r.stewardId) ?? 'Unassigned') : 'Unassigned',
        reason: r.title ?? '',
      }));
    }

    return { stewardStats: stats, stewardPerformance: performance, pendingEscalationsList: escalations };
  });
  stewardStats = result.stewardStats;
  stewardPerformance = result.stewardPerformance;
  pendingEscalationsList = result.pendingEscalationsList;
  } catch (error) {
    console.error('[StewardsDashboard] DB query failed:', error);
    // Fall through with empty defaults
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chief Steward Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Supervise stewards and manage case escalations
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stewards</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.totalStewards}</div>
            <p className="text-xs text-muted-foreground">Active stewards</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.activeCases}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalations</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.pendingEscalations}</div>
            <p className="text-xs text-amber-500">Require review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.completedThisMonth}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.successRate}%</div>
            <p className="text-xs text-green-500">+5% vs last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stewardStats.upcomingTraining}</div>
            <p className="text-xs text-muted-foreground">Upcoming sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* LRO Satisfaction Ratings Link */}
        <div className="md:col-span-2">
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium">LRO Satisfaction Ratings</p>
                  <p className="text-sm text-muted-foreground">
                    View member feedback and performance rankings for all representatives
                  </p>
                </div>
              </div>
              <Link href="/dashboard/stewards/ratings">
                <Button variant="outline" size="sm">
                  View Ratings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Steward Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Steward Performance</CardTitle>
            <CardDescription>Case handling statistics by steward</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stewardPerformance.map((steward, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{steward.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {steward.active} active • {steward.completed} completed
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700">
                    {steward.successRate}% success
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Escalations */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Escalations</CardTitle>
            <CardDescription>Cases requiring chief steward review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingEscalationsList.map((escalation, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{escalation.id}</Badge>
                    <Badge variant="secondary" className="text-amber-700">Escalated</Badge>
                  </div>
                  <div>
                    <div className="font-medium">Member: {escalation.member}</div>
                    <div className="text-sm text-muted-foreground">
                      Steward: {escalation.steward}
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
