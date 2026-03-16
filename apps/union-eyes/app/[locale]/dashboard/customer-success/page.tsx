/**
 * Customer Success Dashboard
 * For Customer Success Director - User success, retention, and growth
 *
 * @role customer_success_director
 * @dashboard_path /dashboard/customer-success
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import Link from 'next/link';
import {
  Heart,
  Users,
  TrendingDown,
  Zap,
  ThumbsUp,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Clipboard,
} from 'lucide-react';

/* ── Types ── */
interface OverviewStats {
  totalOrgs: number;
  activeOrgs: number;
  totalMembers: number;
  activeMembers: number;
  openGrievances: number;
  resolvedGrievances: number;
  totalGrievances: number;
  totalCBAs: number;
  activeCBAs: number;
  expiredCBAs: number;
  negotiatingCBAs: number;
  totalSettlements: number;
  totalSettlementValue: number;
  openTickets: number;
  avgSatisfaction: number;
  npsScore: number;
  totalNpsSurveys: number;
}

interface OrgHealth {
  id: string;
  name: string;
  orgType: string;
  status: string;
  memberCount: number;
  activeMemberCount: number;
  clcAffiliated: boolean;
  logins30d: number;
  pageViews30d: number;
  openTickets: number;
  avgTicketSatisfaction: number | null;
  openGrievances: number;
  resolvedGrievances: number;
  totalCBAs: number;
  npsAvg: number | null;
  healthScore: number;
}

interface OnboardingRow {
  orgName: string;
  milestone: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
}

interface NpsSurvey {
  respondentName: string;
  orgName: string;
  score: number;
  feedback: string | null;
  category: string | null;
  submittedAt: string;
}

interface FeatureAdoption {
  featureName: string;
  module: string;
  usageCount: number;
  activeUsers: number;
  orgCoverage: number;
}

/* ── Data loaders ── */
async function loadOverview(): Promise<OverviewStats> {
  const [orgStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total_orgs,
        COUNT(*) FILTER (WHERE status = 'active') as active_orgs,
        COALESCE(SUM(member_count), 0) as total_members,
        COALESCE(SUM(active_member_count), 0) as active_members
      FROM organizations WHERE organization_type NOT IN ('platform', 'congress')
    `)
  ).map((r: Record<string, unknown>) => r);

  const [grievanceStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status NOT IN ('settled', 'withdrawn', 'denied', 'closed')) as open,
        COUNT(*) FILTER (WHERE status = 'settled') as resolved
      FROM grievances
    `)
  ).map((r: Record<string, unknown>) => r);

  const [cbaStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'under_negotiation') as negotiating
      FROM collective_agreements
    `)
  ).map((r: Record<string, unknown>) => r);

  const [settlementStats] = Array.from(
    await db.execute(sql`
      SELECT COUNT(*) as total, COALESCE(SUM(monetary_amount), 0) as total_value
      FROM settlements
    `)
  ).map((r: Record<string, unknown>) => r);

  const [ticketStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('open', 'in-progress')) as open_tickets,
        ROUND(AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL), 1) as avg_satisfaction
      FROM support_tickets
    `)
  ).map((r: Record<string, unknown>) => r);

  const [npsStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total_surveys,
        ROUND(
          (COUNT(*) FILTER (WHERE score >= 9)::numeric - COUNT(*) FILTER (WHERE score <= 6)::numeric)
          / NULLIF(COUNT(*), 0) * 100
        , 0) as nps_score
      FROM customer_nps_surveys
    `)
  ).map((r: Record<string, unknown>) => r);

  return {
    totalOrgs: Number(orgStats.total_orgs ?? 0),
    activeOrgs: Number(orgStats.active_orgs ?? 0),
    totalMembers: Number(orgStats.total_members ?? 0),
    activeMembers: Number(orgStats.active_members ?? 0),
    openGrievances: Number(grievanceStats.open ?? 0),
    resolvedGrievances: Number(grievanceStats.resolved ?? 0),
    totalGrievances: Number(grievanceStats.total ?? 0),
    totalCBAs: Number(cbaStats.total ?? 0),
    activeCBAs: Number(cbaStats.active ?? 0),
    expiredCBAs: Number(cbaStats.expired ?? 0),
    negotiatingCBAs: Number(cbaStats.negotiating ?? 0),
    totalSettlements: Number(settlementStats.total ?? 0),
    totalSettlementValue: Number(settlementStats.total_value ?? 0),
    openTickets: Number(ticketStats.open_tickets ?? 0),
    avgSatisfaction: Number(ticketStats.avg_satisfaction ?? 0),
    npsScore: Number(npsStats.nps_score ?? 0),
    totalNpsSurveys: Number(npsStats.total_surveys ?? 0),
  };
}

async function loadOrgHealth(): Promise<OrgHealth[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT
        o.id, o.name, o.organization_type as org_type, o.status,
        o.member_count, o.active_member_count, o.clc_affiliated,
        COALESCE((SELECT COUNT(*) FROM platform_login_events l WHERE l.organization_id = o.id AND l.logged_in_at >= NOW() - INTERVAL '30 days'), 0) as logins_30d,
        COALESCE((SELECT COUNT(*) FROM platform_page_views pv WHERE pv.organization_id = o.id AND pv.viewed_at >= NOW() - INTERVAL '30 days'), 0) as page_views_30d,
        COALESCE((SELECT COUNT(*) FROM support_tickets st WHERE st.organization_id = o.id AND st.status IN ('open', 'in-progress')), 0) as open_tickets,
        (SELECT ROUND(AVG(st.satisfaction_rating), 1) FROM support_tickets st WHERE st.organization_id = o.id AND st.satisfaction_rating IS NOT NULL) as avg_ticket_satisfaction,
        COALESCE((SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id AND g.status NOT IN ('settled', 'withdrawn', 'denied', 'closed')), 0) as open_grievances,
        COALESCE((SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id AND g.status = 'settled'), 0) as resolved_grievances,
        COALESCE((SELECT COUNT(*) FROM collective_agreements ca WHERE ca.organization_id = o.id), 0) as total_cbas,
        (SELECT ROUND(AVG(n.score), 1) FROM customer_nps_surveys n WHERE n.organization_id = o.id) as nps_avg
      FROM organizations o
      WHERE o.organization_type NOT IN ('platform', 'congress')
      ORDER BY o.name
    `)
  ).map((r: Record<string, unknown>) => {
    const memberCount = Number(r.member_count ?? 0);
    const activeMemberCount = Number(r.active_member_count ?? 0);
    const clcAffiliated = Boolean(r.clc_affiliated);
    const logins30d = Number(r.logins_30d ?? 0);
    const pageViews30d = Number(r.page_views_30d ?? 0);
    const openGrievances = Number(r.open_grievances ?? 0);
    const npsAvg = r.nps_avg ? Number(r.nps_avg) : null;

    // Compute health: base 40 + activity (up to 20) + satisfaction (up to 20) + engagement (up to 20)
    let health = 40;
    if (String(r.status) === 'active') health += 10;
    if (activeMemberCount > 0) health += 10;
    if (logins30d > 5) health += 10;
    else if (logins30d > 0) health += 5;
    if (pageViews30d > 10) health += 10;
    else if (pageViews30d > 0) health += 5;
    if (npsAvg && npsAvg >= 8) health += 10;
    else if (npsAvg && npsAvg >= 6) health += 5;
    if (clcAffiliated) health += 5;
    if (openGrievances === 0) health += 5;
    health = Math.min(100, health);

    return {
      id: String(r.id),
      name: String(r.name),
      orgType: String(r.org_type),
      status: String(r.status),
      memberCount,
      activeMemberCount,
      clcAffiliated,
      logins30d,
      pageViews30d,
      openTickets: Number(r.open_tickets ?? 0),
      avgTicketSatisfaction: r.avg_ticket_satisfaction ? Number(r.avg_ticket_satisfaction) : null,
      openGrievances,
      resolvedGrievances: Number(r.resolved_grievances ?? 0),
      totalCBAs: Number(r.total_cbas ?? 0),
      npsAvg,
      healthScore: health,
    };
  });
  return rows;
}

async function loadOnboarding(): Promise<OnboardingRow[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT o.name as org_name, m.milestone, m.status, m.completed_at::text, m.notes
      FROM customer_onboarding_milestones m
      JOIN organizations o ON o.id = m.organization_id
      ORDER BY o.name, m.created_at
    `)
  ).map((r: Record<string, unknown>) => ({
    orgName: String(r.org_name),
    milestone: String(r.milestone),
    status: String(r.status),
    completedAt: r.completed_at ? String(r.completed_at) : null,
    notes: r.notes ? String(r.notes) : null,
  }));
  return rows;
}

async function loadNpsSurveys(): Promise<NpsSurvey[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT n.respondent_name, o.name as org_name, n.score, n.feedback, n.category, n.submitted_at::text
      FROM customer_nps_surveys n
      JOIN organizations o ON o.id = n.organization_id
      ORDER BY n.submitted_at DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    respondentName: String(r.respondent_name),
    orgName: String(r.org_name),
    score: Number(r.score),
    feedback: r.feedback ? String(r.feedback) : null,
    category: r.category ? String(r.category) : null,
    submittedAt: String(r.submitted_at),
  }));
  return rows;
}

async function loadFeatureAdoption(): Promise<FeatureAdoption[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT feature_name, module,
        SUM(usage_count)::int as usage_count,
        SUM(active_users)::int as active_users,
        COUNT(DISTINCT organization_id)::int as org_coverage
      FROM platform_feature_adoption
      GROUP BY feature_name, module
      ORDER BY usage_count DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    featureName: String(r.feature_name),
    module: String(r.module),
    usageCount: Number(r.usage_count),
    activeUsers: Number(r.active_users),
    orgCoverage: Number(r.org_coverage),
  }));
  return rows;
}

/* ── Helpers ── */
function healthColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function npsLabel(score: number) {
  if (score >= 9) return { label: 'Promoter', color: 'text-green-600' };
  if (score >= 7) return { label: 'Passive', color: 'text-yellow-600' };
  return { label: 'Detractor', color: 'text-red-600' };
}

/* ── Page ── */
export default async function CustomerSuccessDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();

  const hasAccess = await hasMinRole('customer_success_director');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const tab = params.tab ?? 'overview';

  const [overview, orgHealth, onboarding, npsSurveys, featureAdoption] =
    await withSystemContext(() =>
      Promise.all([
        loadOverview(),
        loadOrgHealth(),
        loadOnboarding(),
        loadNpsSurveys(),
        loadFeatureAdoption(),
      ])
    );

  // Derived
  const atRiskOrgs = orgHealth.filter((o) => o.healthScore < 60);
  const onboardingByOrg: Record<string, OnboardingRow[]> = {};
  for (const m of onboarding) {
    (onboardingByOrg[m.orgName] ??= []).push(m);
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'health', label: 'Customer Health', icon: Heart },
    { key: 'onboarding', label: 'Onboarding', icon: Clipboard },
    { key: 'adoption', label: 'Adoption', icon: Zap },
    { key: 'feedback', label: 'Feedback & NPS', icon: ThumbsUp },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customer Success</h1>
        <p className="text-muted-foreground mt-1">
          Customer health, onboarding, retention, and satisfaction metrics
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        ))}
      </div>

      {/* ───────── OVERVIEW TAB ───────── */}
      {tab === 'overview' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="?tab=health">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Organizations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.totalOrgs}</div>
                  <p className="text-xs text-muted-foreground">
                    {overview.activeOrgs} active · {overview.totalMembers} members
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="?tab=feedback">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    NPS Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${overview.npsScore >= 50 ? 'text-green-600' : overview.npsScore >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {overview.npsScore}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    from {overview.totalNpsSurveys} surveys
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Support Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{overview.avgSatisfaction}/5</div>
                <p className="text-xs text-muted-foreground">
                  {overview.openTickets} open tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  At-Risk Orgs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${atRiskOrgs.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {atRiskOrgs.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  health score &lt; 60
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Customer health summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Customer Health
                </CardTitle>
                <CardDescription>Health scores by organization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orgHealth.map((org) => (
                    <div key={org.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.memberCount} members · {org.logins30d} logins (30d)
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${healthColor(org.healthScore)}`}>
                            {org.healthScore}%
                          </span>
                          {org.healthScore >= 70 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                          )}
                        </div>
                      </div>
                      <Progress value={org.healthScore} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Platform adoption summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Platform Adoption
                </CardTitle>
                <CardDescription>Module usage across the platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">CBAs</p>
                    <p className="text-lg font-bold">{overview.totalCBAs}</p>
                    <p className="text-xs text-muted-foreground">
                      {overview.activeCBAs} active · {overview.negotiatingCBAs} negotiating
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grievances</p>
                    <p className="text-lg font-bold">{overview.totalGrievances}</p>
                    <p className="text-xs text-muted-foreground">
                      {overview.openGrievances} open · {overview.resolvedGrievances} resolved
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Settlements</p>
                    <p className="text-lg font-bold">{overview.totalSettlements}</p>
                    <p className="text-xs text-muted-foreground">
                      ${overview.totalSettlementValue.toLocaleString()} total
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Features Used</p>
                    <p className="text-lg font-bold">{featureAdoption.length}</p>
                    <p className="text-xs text-muted-foreground">
                      across {new Set(featureAdoption.map((f) => f.module)).size} modules
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">CBA Health</p>
                  <div className="space-y-1">
                    {[
                      { label: 'Active', count: overview.activeCBAs, color: 'bg-green-500' },
                      { label: 'Negotiating', count: overview.negotiatingCBAs, color: 'bg-blue-500' },
                      { label: 'Expired', count: overview.expiredCBAs, color: 'bg-red-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                        <span className="text-sm font-bold ml-auto">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ───────── CUSTOMER HEALTH TAB ───────── */}
      {tab === 'health' && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Health Scores</CardTitle>
            <CardDescription>
              Composite score based on activity, satisfaction, engagement, and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Organization</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium text-right">Health</th>
                    <th className="pb-2 font-medium text-right">Members</th>
                    <th className="pb-2 font-medium text-right">Logins (30d)</th>
                    <th className="pb-2 font-medium text-right">Page Views (30d)</th>
                    <th className="pb-2 font-medium text-right">Open Tickets</th>
                    <th className="pb-2 font-medium text-right">Satisfaction</th>
                    <th className="pb-2 font-medium text-right">NPS</th>
                    <th className="pb-2 font-medium text-right">Grievances</th>
                    <th className="pb-2 font-medium text-right">CBAs</th>
                  </tr>
                </thead>
                <tbody>
                  {orgHealth.map((org) => (
                    <tr key={org.id} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="font-medium">{org.name}</div>
                        <Badge variant={org.status === 'active' ? 'default' : 'secondary'} className="mt-1 capitalize">
                          {org.status}
                        </Badge>
                      </td>
                      <td className="py-3 capitalize">{org.orgType}</td>
                      <td className="py-3 text-right">
                        <span className={`font-bold ${healthColor(org.healthScore)}`}>
                          {org.healthScore}%
                        </span>
                      </td>
                      <td className="py-3 text-right">{org.activeMemberCount}/{org.memberCount}</td>
                      <td className="py-3 text-right">{org.logins30d}</td>
                      <td className="py-3 text-right">{org.pageViews30d}</td>
                      <td className="py-3 text-right">{org.openTickets}</td>
                      <td className="py-3 text-right">
                        {org.avgTicketSatisfaction ? `${org.avgTicketSatisfaction}/5` : '—'}
                      </td>
                      <td className="py-3 text-right">
                        {org.npsAvg ? org.npsAvg.toFixed(1) : '—'}
                      </td>
                      <td className="py-3 text-right">
                        {org.openGrievances > 0 && (
                          <span className="text-yellow-600">{org.openGrievances} open</span>
                        )}
                        {org.openGrievances > 0 && org.resolvedGrievances > 0 && ' / '}
                        {org.resolvedGrievances > 0 && (
                          <span className="text-green-600">{org.resolvedGrievances} resolved</span>
                        )}
                        {org.openGrievances === 0 && org.resolvedGrievances === 0 && '—'}
                      </td>
                      <td className="py-3 text-right">{org.totalCBAs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── ONBOARDING TAB ───────── */}
      {tab === 'onboarding' && (
        <div className="space-y-6">
          {Object.entries(onboardingByOrg).map(([orgName, milestones]) => {
            const completed = milestones?.filter((m) => m.status === 'completed').length ?? 0;
            const total = milestones?.length ?? 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <Card key={orgName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{orgName}</CardTitle>
                      <CardDescription>
                        {completed}/{total} milestones completed
                      </CardDescription>
                    </div>
                    <span className={`text-lg font-bold ${pct === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                      {pct}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {milestones?.map((m) => (
                      <div key={m.milestone} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div className="flex items-center gap-2">
                          {m.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : m.status === 'in-progress' ? (
                            <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{m.milestone}</p>
                            {m.notes && (
                              <p className="text-xs text-muted-foreground">{m.notes}</p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={m.status === 'completed' ? 'default' : m.status === 'in-progress' ? 'secondary' : 'outline'}
                          className="capitalize"
                        >
                          {m.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ───────── ADOPTION TAB ───────── */}
      {tab === 'adoption' && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{featureAdoption.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Modules Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(featureAdoption.map((f) => f.module)).size}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Usage Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {featureAdoption.reduce((sum, f) => sum + f.usageCount, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Org Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {featureAdoption.length > 0
                    ? (featureAdoption.reduce((sum, f) => sum + f.orgCoverage, 0) / featureAdoption.length).toFixed(1)
                    : 0}{' '}
                  orgs
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption</CardTitle>
              <CardDescription>Usage across the platform by feature</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Feature</th>
                      <th className="pb-2 font-medium">Module</th>
                      <th className="pb-2 font-medium text-right">Usage Count</th>
                      <th className="pb-2 font-medium text-right">Active Users</th>
                      <th className="pb-2 font-medium text-right">Org Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featureAdoption.map((f) => (
                      <tr key={`${f.featureName}-${f.module}`} className="border-b last:border-0">
                        <td className="py-2 font-medium">{f.featureName}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="capitalize">{f.module}</Badge>
                        </td>
                        <td className="py-2 text-right">{f.usageCount.toLocaleString()}</td>
                        <td className="py-2 text-right">{f.activeUsers}</td>
                        <td className="py-2 text-right">{f.orgCoverage} org{f.orgCoverage !== 1 ? 's' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ───────── FEEDBACK & NPS TAB ───────── */}
      {tab === 'feedback' && (
        <>
          {/* NPS summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${overview.npsScore >= 50 ? 'text-green-600' : overview.npsScore >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {overview.npsScore}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.npsScore >= 50 ? 'Excellent' : overview.npsScore >= 30 ? 'Good' : overview.npsScore >= 0 ? 'Fair' : 'Needs improvement'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Survey Responses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{npsSurveys.length}</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-green-600">
                    {npsSurveys.filter((s) => s.score >= 9).length} promoters
                  </span>
                  <span className="text-xs text-yellow-600">
                    {npsSurveys.filter((s) => s.score >= 7 && s.score <= 8).length} passive
                  </span>
                  <span className="text-xs text-red-600">
                    {npsSurveys.filter((s) => s.score <= 6).length} detractors
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg NPS by Org</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {orgHealth.map((org) => (
                    <div key={org.id} className="flex items-center justify-between text-sm">
                      <span>{org.name}</span>
                      <span className="font-bold">{org.npsAvg ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Survey detail */}
          <Card>
            <CardHeader>
              <CardTitle>NPS Survey Responses</CardTitle>
              <CardDescription>Individual feedback from organization members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {npsSurveys.map((s, i) => {
                  const { label, color } = npsLabel(s.score);
                  return (
                    <div key={i} className="border-b pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{s.respondentName}</span>
                          <span className="text-xs text-muted-foreground">{s.orgName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${color}`}>{s.score}/10</span>
                          <Badge variant={s.score >= 9 ? 'default' : s.score >= 7 ? 'secondary' : 'destructive'}>
                            {label}
                          </Badge>
                        </div>
                      </div>
                      {s.feedback && (
                        <p className="text-sm text-muted-foreground">{s.feedback}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {s.category && (
                          <Badge variant="outline" className="text-xs capitalize">{s.category}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
