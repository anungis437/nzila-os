/**
 * Analytics Admin Dashboard
 * For Data Analytics Manager & Data Analysts - Platform-wide analytics
 *
 * @role data_analytics_manager, data_analyst
 * @dashboard_path /dashboard/analytics-admin
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { BarChart3, Users, FileText, TrendingUp, Activity, Eye, LogIn, Layers, Building2, Clock, X } from 'lucide-react';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

/* ─── types ─── */
interface ModuleUsage {
  module: string;
  views: number;
  avg_duration_sec: number;
}

interface OrgInsight {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  member_count: number;
  page_views_30d: number;
  logins_30d: number;
  active_users_30d: number;
  features_adopted: number;
  avg_session_sec: number;
}

interface FeatureAdoption {
  feature_name: string;
  module: string;
  total_usage: number;
  total_active_users: number;
  org_count: number;
  first_used: string;
  last_used: string;
}

interface LoginBreakdown {
  login_method: string;
  count: number;
}

interface AnalyticsStats {
  total_organizations: number;
  total_members: number;
  active_users_30d: number;
  active_users_prev_30d: number;
  page_views_30d: number;
  page_views_prev_30d: number;
  logins_30d: number;
  logins_prev_30d: number;
  total_grievances: number;
  total_agreements: number;
  total_features: number;
  avg_session_sec: number;
}

/* ─── data loaders ─── */
async function loadStats(): Promise<AnalyticsStats> {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM organizations)::int AS total_organizations,
      (SELECT COALESCE(SUM(member_count), 0) FROM organizations)::int AS total_members,
      (SELECT COUNT(DISTINCT user_id) FROM platform_login_events WHERE logged_in_at >= now() - interval '30 days')::int AS active_users_30d,
      (SELECT COUNT(DISTINCT user_id) FROM platform_login_events WHERE logged_in_at >= now() - interval '60 days' AND logged_in_at < now() - interval '30 days')::int AS active_users_prev_30d,
      (SELECT COUNT(*) FROM platform_page_views WHERE viewed_at >= now() - interval '30 days')::int AS page_views_30d,
      (SELECT COUNT(*) FROM platform_page_views WHERE viewed_at >= now() - interval '60 days' AND viewed_at < now() - interval '30 days')::int AS page_views_prev_30d,
      (SELECT COUNT(*) FROM platform_login_events WHERE logged_in_at >= now() - interval '30 days')::int AS logins_30d,
      (SELECT COUNT(*) FROM platform_login_events WHERE logged_in_at >= now() - interval '60 days' AND logged_in_at < now() - interval '30 days')::int AS logins_prev_30d,
      (SELECT COUNT(*) FROM grievances)::int AS total_grievances,
      (SELECT COUNT(*) FROM collective_agreements)::int AS total_agreements,
      (SELECT COUNT(DISTINCT feature_name) FROM platform_feature_adoption)::int AS total_features,
      (SELECT COALESCE(AVG(session_duration_sec), 0) FROM platform_page_views WHERE viewed_at >= now() - interval '30 days')::int AS avg_session_sec
  `);
  const r = Array.from(result)[0] as Record<string, unknown>;
  return {
    total_organizations: Number(r.total_organizations),
    total_members: Number(r.total_members),
    active_users_30d: Number(r.active_users_30d),
    active_users_prev_30d: Number(r.active_users_prev_30d),
    page_views_30d: Number(r.page_views_30d),
    page_views_prev_30d: Number(r.page_views_prev_30d),
    logins_30d: Number(r.logins_30d),
    logins_prev_30d: Number(r.logins_prev_30d),
    total_grievances: Number(r.total_grievances),
    total_agreements: Number(r.total_agreements),
    total_features: Number(r.total_features),
    avg_session_sec: Number(r.avg_session_sec),
  };
}

async function loadModuleUsage(): Promise<ModuleUsage[]> {
  const result = await db.execute(sql`
    SELECT module, COUNT(*)::int AS views, COALESCE(AVG(session_duration_sec), 0)::int AS avg_duration_sec
    FROM platform_page_views
    WHERE viewed_at >= now() - interval '30 days'
    GROUP BY module
    ORDER BY views DESC
  `);
  return Array.from(result).map((r: Record<string, unknown>) => ({
    module: String(r.module),
    views: Number(r.views),
    avg_duration_sec: Number(r.avg_duration_sec),
  }));
}

async function loadOrgInsights(): Promise<OrgInsight[]> {
  const result = await db.execute(sql`
    SELECT
      o.id, o.name, o.slug, o.organization_type, o.member_count,
      COALESCE(pv.cnt, 0)::int AS page_views_30d,
      COALESCE(le.cnt, 0)::int AS logins_30d,
      COALESCE(le.active, 0)::int AS active_users_30d,
      COALESCE(fa.cnt, 0)::int AS features_adopted,
      COALESCE(pv.avg_dur, 0)::int AS avg_session_sec
    FROM organizations o
    LEFT JOIN (
      SELECT organization_id, COUNT(*) AS cnt, AVG(session_duration_sec) AS avg_dur
      FROM platform_page_views WHERE viewed_at >= now() - interval '30 days'
      GROUP BY organization_id
    ) pv ON pv.organization_id = o.id
    LEFT JOIN (
      SELECT organization_id, COUNT(*) AS cnt, COUNT(DISTINCT user_id) AS active
      FROM platform_login_events WHERE logged_in_at >= now() - interval '30 days'
      GROUP BY organization_id
    ) le ON le.organization_id = o.id
    LEFT JOIN (
      SELECT organization_id, COUNT(DISTINCT feature_name) AS cnt
      FROM platform_feature_adoption
      GROUP BY organization_id
    ) fa ON fa.organization_id = o.id
    ORDER BY page_views_30d DESC
  `);
  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    organization_type: String(r.organization_type),
    member_count: Number(r.member_count),
    page_views_30d: Number(r.page_views_30d),
    logins_30d: Number(r.logins_30d),
    active_users_30d: Number(r.active_users_30d),
    features_adopted: Number(r.features_adopted),
    avg_session_sec: Number(r.avg_session_sec),
  }));
}

async function loadFeatureAdoption(moduleFilter?: string): Promise<FeatureAdoption[]> {
  const whereClause = moduleFilter ? sql`WHERE fa.module = ${moduleFilter}` : sql``;
  const result = await db.execute(sql`
    SELECT
      fa.feature_name,
      fa.module,
      SUM(fa.usage_count)::int AS total_usage,
      SUM(fa.active_users)::int AS total_active_users,
      COUNT(DISTINCT fa.organization_id)::int AS org_count,
      MIN(fa.first_used_at)::text AS first_used,
      MAX(fa.last_used_at)::text AS last_used
    FROM platform_feature_adoption fa
    ${whereClause}
    GROUP BY fa.feature_name, fa.module
    ORDER BY total_usage DESC
  `);
  return Array.from(result).map((r: Record<string, unknown>) => ({
    feature_name: String(r.feature_name),
    module: String(r.module),
    total_usage: Number(r.total_usage),
    total_active_users: Number(r.total_active_users),
    org_count: Number(r.org_count),
    first_used: String(r.first_used).slice(0, 10),
    last_used: String(r.last_used).slice(0, 10),
  }));
}

async function loadLoginBreakdown(): Promise<LoginBreakdown[]> {
  const result = await db.execute(sql`
    SELECT login_method, COUNT(*)::int AS count
    FROM platform_login_events
    WHERE logged_in_at >= now() - interval '30 days'
    GROUP BY login_method
    ORDER BY count DESC
  `);
  return Array.from(result).map((r: Record<string, unknown>) => ({
    login_method: String(r.login_method),
    count: Number(r.count),
  }));
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100' : '0';
  const pct = ((current - previous) / previous) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1);
}

/* ─── page ─── */
export default async function AnalyticsAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; module?: string }>;
}) {
  await requireUser();

  const hasAccess = await hasMinRole('data_analyst');
  if (!hasAccess) redirect('/dashboard');

  const params = await searchParams;
  const activeTab = params.tab || 'overview';
  const moduleFilter = params.module;

  const [stats, moduleUsage, orgInsights, features, loginBreakdown] = await withSystemContext(() =>
    Promise.all([
      loadStats(),
      loadModuleUsage(),
      loadOrgInsights(),
      loadFeatureAdoption(moduleFilter),
      loadLoginBreakdown(),
    ])
  );

  const maxModuleViews = moduleUsage.length > 0 ? Math.max(...moduleUsage.map((m) => m.views)) : 1;
  const maxFeatureUsage = features.length > 0 ? Math.max(...features.map((f) => f.total_usage)) : 1;
  const totalLogins30d = loginBreakdown.reduce((s, l) => s + l.count, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Cross-organization analytics, usage patterns, and feature adoption
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" asChild>
            <Link href="?tab=overview">Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="organizations" asChild>
            <Link href="?tab=organizations">Organizations</Link>
          </TabsTrigger>
          <TabsTrigger value="usage" asChild>
            <Link href="?tab=usage">Usage</Link>
          </TabsTrigger>
          <TabsTrigger value="features" asChild>
            <Link href="?tab=features">Features</Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="?tab=organizations">
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Organizations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_organizations}</div>
                  <p className="text-xs text-muted-foreground">{stats.total_members} total members</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="?tab=usage">
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Active Users (30d)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.active_users_30d}</div>
                  <p className={`text-xs ${Number(pctChange(stats.active_users_30d, stats.active_users_prev_30d).replace('+', '')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pctChange(stats.active_users_30d, stats.active_users_prev_30d)}% from prev 30d
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="?tab=usage">
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Page Views (30d)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.page_views_30d}</div>
                  <p className={`text-xs ${Number(pctChange(stats.page_views_30d, stats.page_views_prev_30d).replace('+', '')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pctChange(stats.page_views_30d, stats.page_views_prev_30d)}% from prev 30d
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="?tab=features">
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Features Tracked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_features}</div>
                  <p className="text-xs text-muted-foreground">Across all modules</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage by Module (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {moduleUsage.map((m) => (
                    <div key={m.module} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{m.module}</span>
                        <span className="text-muted-foreground">{m.views} views · {m.avg_duration_sec}s avg</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.round((m.views / maxModuleViews) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Logins (30d)</span>
                    <span className="text-lg font-bold">{stats.logins_30d}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Login Growth</span>
                    <span className={`text-lg font-bold ${Number(pctChange(stats.logins_30d, stats.logins_prev_30d).replace('+', '')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pctChange(stats.logins_30d, stats.logins_prev_30d)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Session Duration</span>
                    <span className="text-lg font-bold">{Math.floor(stats.avg_session_sec / 60)}m {stats.avg_session_sec % 60}s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cases Filed</span>
                    <span className="text-lg font-bold">{stats.total_grievances}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Agreements</span>
                    <span className="text-lg font-bold">{stats.total_agreements}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Organizations ── */}
        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Organization</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium text-right">Members</th>
                      <th className="pb-2 font-medium text-right">Active Users</th>
                      <th className="pb-2 font-medium text-right">Page Views</th>
                      <th className="pb-2 font-medium text-right">Logins</th>
                      <th className="pb-2 font-medium text-right">Features</th>
                      <th className="pb-2 font-medium text-right">Avg Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgInsights.map((org) => (
                      <tr key={org.id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">{org.slug}</div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                            {org.organization_type}
                          </span>
                        </td>
                        <td className="py-3 text-right">{org.member_count}</td>
                        <td className="py-3 text-right">{org.active_users_30d}</td>
                        <td className="py-3 text-right">{org.page_views_30d}</td>
                        <td className="py-3 text-right">{org.logins_30d}</td>
                        <td className="py-3 text-right">{org.features_adopted}</td>
                        <td className="py-3 text-right">{Math.floor(org.avg_session_sec / 60)}m {org.avg_session_sec % 60}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Usage ── */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Total Logins (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.logins_30d}</div>
                <p className={`text-xs ${Number(pctChange(stats.logins_30d, stats.logins_prev_30d).replace('+', '')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pctChange(stats.logins_30d, stats.logins_prev_30d)}% vs prev period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Page Views (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.page_views_30d}</div>
                <p className={`text-xs ${Number(pctChange(stats.page_views_30d, stats.page_views_prev_30d).replace('+', '')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pctChange(stats.page_views_30d, stats.page_views_prev_30d)}% vs prev period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Session Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.floor(stats.avg_session_sec / 60)}m {stats.avg_session_sec % 60}s</div>
                <p className="text-xs text-muted-foreground">Across all modules</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Login Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loginBreakdown.map((lb) => (
                    <div key={lb.login_method} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="uppercase font-medium">{lb.login_method}</span>
                        <span className="text-muted-foreground">{lb.count} ({totalLogins30d > 0 ? Math.round((lb.count / totalLogins30d) * 100) : 0}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${totalLogins30d > 0 ? Math.round((lb.count / totalLogins30d) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Module Page Views (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {moduleUsage.map((m) => (
                    <div key={m.module} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                      <span className="capitalize font-medium">{m.module}</span>
                      <div className="text-right">
                        <span className="font-bold">{m.views}</span>
                        <span className="text-muted-foreground ml-2">({m.avg_duration_sec}s avg)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Features ── */}
        <TabsContent value="features" className="space-y-4">
          {moduleFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtered by module:</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground capitalize">
                {moduleFilter}
                <Link href="?tab=features" className="ml-1 hover:text-primary-foreground/80">
                  <X className="h-3 w-3" />
                </Link>
              </span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Feature Adoption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Feature</th>
                      <th className="pb-2 font-medium">Module</th>
                      <th className="pb-2 font-medium text-right">Total Usage</th>
                      <th className="pb-2 font-medium text-right">Active Users</th>
                      <th className="pb-2 font-medium text-right">Orgs</th>
                      <th className="pb-2 font-medium text-right">First Used</th>
                      <th className="pb-2 font-medium text-right">Last Used</th>
                      <th className="pb-2 font-medium w-32">Adoption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.feature_name} className="border-b last:border-0">
                        <td className="py-3 font-medium">{f.feature_name}</td>
                        <td className="py-3">
                          <Link
                            href={`?tab=features&module=${encodeURIComponent(f.module)}`}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground capitalize hover:bg-secondary/80"
                          >
                            {f.module}
                          </Link>
                        </td>
                        <td className="py-3 text-right font-bold">{f.total_usage.toLocaleString()}</td>
                        <td className="py-3 text-right">{f.total_active_users}</td>
                        <td className="py-3 text-right">{f.org_count}/{stats.total_organizations}</td>
                        <td className="py-3 text-right text-muted-foreground">{f.first_used}</td>
                        <td className="py-3 text-right text-muted-foreground">{f.last_used}</td>
                        <td className="py-3">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${Math.round((f.total_usage / maxFeatureUsage) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Module Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {Array.from(new Set(features.map((f) => f.module))).map((mod) => {
                  const modFeatures = features.filter((f) => f.module === mod);
                  const totalUsage = modFeatures.reduce((s, f) => s + f.total_usage, 0);
                  const totalUsers = modFeatures.reduce((s, f) => s + f.total_active_users, 0);
                  return (
                    <Link key={mod} href={`?tab=features&module=${encodeURIComponent(mod)}`}>
                      <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardContent className="pt-4">
                          <div className="text-sm font-medium capitalize">{mod}</div>
                          <div className="text-2xl font-bold mt-1">{totalUsage.toLocaleString()}</div>
                          <p className="text-xs text-muted-foreground">{modFeatures.length} features · {totalUsers} users</p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Platform Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 text-center">
            <div>
              <div className="text-2xl font-bold">{stats.total_organizations}</div>
              <div className="text-xs text-muted-foreground">Organizations</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total_members}</div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total_grievances}</div>
              <div className="text-xs text-muted-foreground">Grievances</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total_agreements}</div>
              <div className="text-xs text-muted-foreground">Agreements</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
