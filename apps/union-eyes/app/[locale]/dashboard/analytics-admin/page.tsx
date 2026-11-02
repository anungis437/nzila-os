/**
 * Analytics Admin Dashboard
 * For Data Analytics Manager & Data Analysts - Platform-wide analytics
 *
 * Organization, member, grievance and agreement figures are live. Usage telemetry (page views, sign-ins, feature adoption) is not collected, so the page says so
 * instead of reading relations that do not exist (capability UE-PLATFORM-USAGE-TELEMETRY, lib/reality/capability-registry.ts).
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
import { Building2, FileText } from 'lucide-react';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getLocale, getTranslations } from 'next-intl/server';
import { UsageTelemetryNotice } from '@/components/platform/usage-telemetry-notice';

/* ─── types ─── */
interface OrgInsight {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  member_count: number;
  grievance_count: number;
  agreement_count: number;
}

interface AnalyticsStats {
  total_organizations: number;
  total_members: number;
  total_grievances: number;
  total_agreements: number;
}

const TABS = ['overview', 'organizations'] as const;

/* ─── data loaders ─── */
async function loadStats(): Promise<AnalyticsStats> {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM organizations)::int AS total_organizations,
      (SELECT COALESCE(SUM(member_count), 0) FROM organizations)::int AS total_members,
      (SELECT COUNT(*) FROM grievances)::int AS total_grievances,
      (SELECT COUNT(*) FROM collective_agreements)::int AS total_agreements
  `);
  const r = Array.from(result)[0] as Record<string, unknown>;
  return {
    total_organizations: Number(r.total_organizations),
    total_members: Number(r.total_members),
    total_grievances: Number(r.total_grievances),
    total_agreements: Number(r.total_agreements),
  };
}

async function loadOrgInsights(): Promise<OrgInsight[]> {
  const result = await db.execute(sql`
    SELECT
      o.id, o.name, o.slug, o.organization_type, o.member_count,
      (SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id)::int AS grievance_count,
      (SELECT COUNT(*) FROM collective_agreements ca WHERE ca.organization_id = o.id)::int AS agreement_count
    FROM organizations o
    ORDER BY o.name
  `);
  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    organization_type: String(r.organization_type),
    member_count: Number(r.member_count),
    grievance_count: Number(r.grievance_count),
    agreement_count: Number(r.agreement_count),
  }));
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

/* ─── page ─── */
export default async function AnalyticsAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations('analyticsAdminPage');
  await requireUser();

  const hasAccess = await hasMinRole('data_analyst');
  if (!hasAccess) redirect(`/${locale}/dashboard`);

  const params = await searchParams;
  const activeTab = TABS.find((tab) => tab === params.tab) ?? 'overview';

  const [stats, orgInsights] = await withSystemContext(() =>
    Promise.all([loadStats(), loadOrgInsights()])
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" asChild>
            <Link href="?tab=overview">{t('tabs.overview')}</Link>
          </TabsTrigger>
          <TabsTrigger value="organizations" asChild>
            <Link href="?tab=organizations">{t('tabs.organizations')}</Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('platformSummary.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{formatCount(stats.total_organizations, locale)}</div>
                  <div className="text-xs text-muted-foreground">{t('platformSummary.organizations')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCount(stats.total_members, locale)}</div>
                  <div className="text-xs text-muted-foreground">{t('platformSummary.members')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCount(stats.total_grievances, locale)}</div>
                  <div className="text-xs text-muted-foreground">{t('platformSummary.grievances')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCount(stats.total_agreements, locale)}</div>
                  <div className="text-xs text-muted-foreground">{t('platformSummary.agreements')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <UsageTelemetryNotice />
        </TabsContent>

        {/* ── Organizations ── */}
        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t('organizations.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">{t('organizations.table.organization')}</th>
                      <th className="pb-2 font-medium">{t('organizations.table.type')}</th>
                      <th className="pb-2 font-medium text-right">{t('organizations.table.members')}</th>
                      <th className="pb-2 font-medium text-right">{t('platformSummary.grievances')}</th>
                      <th className="pb-2 font-medium text-right">{t('platformSummary.agreements')}</th>
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
                        <td className="py-3 text-right">{formatCount(org.member_count, locale)}</td>
                        <td className="py-3 text-right">{formatCount(org.grievance_count, locale)}</td>
                        <td className="py-3 text-right">{formatCount(org.agreement_count, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <UsageTelemetryNotice />
        </TabsContent>
      </Tabs>
    </div>
  );
}
