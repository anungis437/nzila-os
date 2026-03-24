export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getOrganizationId } from '@/lib/organization-middleware';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { BarChart3, TrendingUp, Award, Gift, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rewards Reports | Admin',
  description: 'Rewards analytics and insights dashboard',
};

export default async function AdminRewardsReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser();
  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.reports');
  const orgId = await getOrganizationId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stats: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentAwards: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topRecipients: any[] = [];

  try {
    const result = await withSystemContext(async () => {
      // Overall stats
      const overallResult = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM recognition_programs WHERE organization_id = ${orgId}::uuid AND deleted_at IS NULL) AS total_programs,
          (SELECT COUNT(*) FROM recognition_awards WHERE organization_id = ${orgId}::uuid) AS total_awards,
          (SELECT COUNT(*) FROM recognition_awards WHERE organization_id = ${orgId}::uuid AND status = 'issued') AS issued_awards,
          (SELECT COUNT(*) FROM recognition_awards WHERE organization_id = ${orgId}::uuid AND status = 'pending') AS pending_awards,
          (SELECT COUNT(*) FROM recognition_awards WHERE organization_id = ${orgId}::uuid AND created_at > NOW() - INTERVAL '30 days') AS awards_this_month,
          (SELECT COALESCE(SUM(points_value), 0) FROM recognition_awards WHERE organization_id = ${orgId}::uuid AND status = 'issued') AS total_points_issued,
          (SELECT COUNT(DISTINCT recipient_id) FROM recognition_awards WHERE organization_id = ${orgId}::uuid AND status = 'issued') AS unique_recipients,
          (SELECT COUNT(DISTINCT nominator_id) FROM recognition_awards WHERE organization_id = ${orgId}::uuid AND status = 'issued') AS unique_nominators
      `);

      // Recent awards
      const recentResult = await db.execute(sql`
        SELECT
          ra.id,
          ra.status,
          ra.points_value,
          ra.created_at,
          ra.message,
          om_r.first_name AS recipient_first_name,
          om_r.last_name AS recipient_last_name,
          om_n.first_name AS nominator_first_name,
          om_n.last_name AS nominator_last_name,
          rat.name AS award_type_name
        FROM recognition_awards ra
        LEFT JOIN organization_members om_r ON om_r.id = ra.recipient_id
        LEFT JOIN organization_members om_n ON om_n.id = ra.nominator_id
        LEFT JOIN recognition_award_types rat ON rat.id = ra.award_type_id
        WHERE ra.organization_id = ${orgId}::uuid
        ORDER BY ra.created_at DESC
        LIMIT 10
      `);

      // Top recipients by points
      const topResult = await db.execute(sql`
        SELECT
          om.first_name,
          om.last_name,
          om.email,
          COUNT(ra.id) AS award_count,
          COALESCE(SUM(ra.points_value), 0) AS total_points
        FROM recognition_awards ra
        JOIN organization_members om ON om.id = ra.recipient_id
        WHERE ra.organization_id = ${orgId}::uuid
          AND ra.status = 'issued'
        GROUP BY om.id, om.first_name, om.last_name, om.email
        ORDER BY total_points DESC
        LIMIT 10
      `);

      return {
        stats: Array.from(overallResult)[0] || {},
        recent: Array.from(recentResult),
        top: Array.from(topResult),
      };
    });

    stats = result.stats;
    recentAwards = result.recent;
    topRecipients = result.top;
  } catch (e) {
    logger.error('[REWARDS] reports query failed', e instanceof Error ? e : new Error(String(e)));
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <Link
          href={`/${locale}/dashboard/admin/rewards`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          &larr; {t('backToAdmin', { defaultValue: 'Back to Admin' })}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('title', { defaultValue: 'Rewards Reports' })}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('description', { defaultValue: 'Analytics and insights for your recognition programs' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <CardDescription>{t('kpi.totalAwards', { defaultValue: 'Total Awards' })}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{Number(stats.total_awards ?? 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <CardDescription>{t('kpi.thisMonth', { defaultValue: 'This Month' })}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{Number(stats.awards_this_month ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-500" />
              <CardDescription>{t('kpi.pointsIssued', { defaultValue: 'Points Issued' })}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{Number(stats.total_points_issued ?? 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <CardDescription>{t('kpi.recipients', { defaultValue: 'Unique Recipients' })}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{Number(stats.unique_recipients ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Engagement Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('engagement.programs', { defaultValue: 'Active Programs' })}</CardDescription>
            <CardTitle>{Number(stats.total_programs ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('engagement.pending', { defaultValue: 'Pending Approval' })}</CardDescription>
            <CardTitle>{Number(stats.pending_awards ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('engagement.nominators', { defaultValue: 'Unique Nominators' })}</CardDescription>
            <CardTitle>{Number(stats.unique_nominators ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Two Column: Recent Awards + Top Recipients */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Awards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t('recent.title', { defaultValue: 'Recent Awards' })}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAwards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('recent.empty', { defaultValue: 'No awards yet' })}
              </p>
            ) : (
              <div className="space-y-3">
                {recentAwards.map((award) => (
                  <div key={award.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">
                        {award.recipient_first_name} {award.recipient_last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {award.award_type_name ?? 'Award'} &middot; by {award.nominator_first_name ?? 'System'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{Number(award.points_value ?? 0).toLocaleString()} pts</p>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        award.status === 'issued' ? 'bg-green-100 text-green-700' :
                        award.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {award.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('topRecipients.title', { defaultValue: 'Top Recipients' })}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('topRecipients.empty', { defaultValue: 'No data yet' })}
              </p>
            ) : (
              <div className="space-y-3">
                {topRecipients.map((r, idx) => (
                  <div key={r.email} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5">#{idx + 1}</span>
                      <div>
                        <p className="font-medium">{r.first_name} {r.last_name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{Number(r.total_points).toLocaleString()} pts</p>
                      <p className="text-xs text-muted-foreground">{r.award_count} awards</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
