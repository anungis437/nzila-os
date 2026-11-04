export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { isUuid } from '@/lib/page-data/uuid';
import { loadRewardsReport } from '@/lib/rewards/admin-reads';
import { BarChart3, TrendingUp, Award, Gift, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rewards Reports | Admin',
  description: 'Rewards analytics and insights dashboard',
};

interface RecentAward {
  id: string;
  status: string;
  points_value: unknown;
  recipient_name: string | null;
  nominator_name: string | null;
  award_type_name: string | null;
}

interface TopRecipient {
  user_id: string;
  name: string;
  email: string;
  award_count: unknown;
  total_points: unknown;
}

export default async function AdminRewardsReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser();
  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.reports');
  const format = await getFormatter();
  // The organization is the administrator's own, from their verified membership: never the cookie the browser sends.
  const orgId = user.organizationId;
  if (!isUuid(orgId)) {
    redirect('/dashboard');
  }

  // A failed read is an error, not an empty report: nothing here catches it.
  const report = await loadRewardsReport(orgId);
  const { stats } = report;
  const recentAwards = report.recent as unknown as RecentAward[];
  const topRecipients = report.top as unknown as TopRecipient[];

  const number = (value: unknown) => format.number(Number(value ?? 0));
  const statusLabels: Record<string, string> = {
    pending: t('status.pending'),
    approved: t('status.approved'),
    issued: t('status.issued'),
    rejected: t('status.rejected'),
    revoked: t('status.revoked'),
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <Link
          href={`/${locale}/dashboard/admin/rewards`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          &larr; {t('backToAdmin')}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardDescription>{t('kpi.totalAwards')}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{number(stats.total_awards)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
              <CardDescription>{t('kpi.last30Days')}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{number(stats.awards_last_30_days)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <CardDescription>{t('kpi.creditsIssued')}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{number(stats.credits_issued)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <CardDescription>{t('kpi.recipients')}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{number(stats.unique_recipients)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Engagement Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('engagement.programs')}</CardDescription>
            <CardTitle>{number(stats.active_programs)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('engagement.pending')}</CardDescription>
            <CardTitle>{number(stats.pending_awards)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('engagement.givers')}</CardDescription>
            <CardTitle>{number(stats.unique_givers)}</CardTitle>
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
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                {t('recent.title')}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAwards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('recent.empty')}</p>
            ) : (
              <div className="space-y-3">
                {recentAwards.map((award) => (
                  <div key={award.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{award.recipient_name ?? t('recent.formerMember')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('recent.by', {
                          type: award.award_type_name ?? t('recent.fallbackType'),
                          name: award.nominator_name ?? t('recent.system'),
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{t('creditsCount', { count: Number(award.points_value ?? 0) })}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          award.status === 'issued'
                            ? 'bg-green-100 text-green-700'
                            : award.status === 'approved'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {statusLabels[award.status] ?? award.status}
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
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                {t('topRecipients.title')}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('topRecipients.empty')}</p>
            ) : (
              <div className="space-y-3">
                {topRecipients.map((r, idx) => (
                  <div key={r.user_id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5">#{idx + 1}</span>
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{t('creditsCount', { count: Number(r.total_points ?? 0) })}</p>
                      <p className="text-xs text-muted-foreground">{t('awardsCount', { count: Number(r.award_count ?? 0) })}</p>
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
