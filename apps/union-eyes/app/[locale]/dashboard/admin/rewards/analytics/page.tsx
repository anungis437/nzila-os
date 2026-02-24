export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Users,
  Award,
  DollarSign,
  Download,
  Calendar,
} from 'lucide-react';
import { sql } from 'drizzle-orm';
import {
  recognitionAwards,
  recognitionPrograms,
  rewardWalletLedger,
  rewardBudgetEnvelopes,
  rewardRedemptions,
} from '@/db/schema/recognition-rewards-schema';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Analytics & Reporting | Rewards Admin',
  description: 'ROI and performance metrics for recognition programs',
};

async function getAnalyticsData(orgId: string, startDate: Date, endDate: Date) {
  // Overview metrics
  const overviewQuery = sql`
    SELECT 
      COUNT(DISTINCT ra.id) as total_awards,
      COUNT(DISTINCT ra.recipient_user_id) as unique_recipients,
      COUNT(DISTINCT ra.issuer_user_id) as unique_issuers,
      COALESCE(SUM(ra.credits_awarded), 0) as total_credits_awarded,
      COUNT(DISTINCT CASE WHEN ra.status = 'issued' THEN ra.id END) as issued_awards,
      COUNT(DISTINCT CASE WHEN ra.status = 'pending' THEN ra.id END) as pending_awards
    FROM ${recognitionAwards} ra
    WHERE ra.org_id = ${orgId}
      AND ra.created_at BETWEEN ${startDate} AND ${endDate}
  `;

  // Redemption metrics
  const redemptionQuery = sql`
    SELECT 
      COUNT(rr.id) as total_redemptions,
      COALESCE(SUM(rr.credits_redeemed), 0) as total_credits_redeemed,
      COUNT(CASE WHEN rr.status = 'fulfilled' THEN 1 END) as fulfilled_redemptions
    FROM ${rewardRedemptions} rr
    WHERE rr.org_id = ${orgId}
      AND rr.created_at BETWEEN ${startDate} AND ${endDate}
  `;

  // Budget usage
  const budgetQuery = sql`
    SELECT 
      rbe.id,
      rbe.budget_name,
      rbe.total_credits,
      rbe.used_credits,
      rbe.scope_type,
      rp.name as program_name
    FROM ${rewardBudgetEnvelopes} rbe
    LEFT JOIN ${recognitionPrograms} rp ON rp.id = rbe.program_id
    WHERE rbe.org_id = ${orgId}
      AND rbe.starts_at <= ${endDate}
      AND rbe.ends_at >= ${startDate}
    ORDER BY rbe.used_credits DESC
    LIMIT 10
  `;

  // Top award types
  const topAwardTypesQuery = sql`
    SELECT 
      ra.award_type_id,
      rat.name as award_type_name,
      rat.icon,
      COUNT(ra.id) as count,
      SUM(ra.credits_awarded) as total_credits
    FROM ${recognitionAwards} ra
    LEFT JOIN recognition_award_types rat ON rat.id = ra.award_type_id
    WHERE ra.org_id = ${orgId}
      AND ra.created_at BETWEEN ${startDate} AND ${endDate}
      AND ra.status = 'issued'
    GROUP BY ra.award_type_id, rat.name, rat.icon
    ORDER BY count DESC
    LIMIT 10
  `;

  // Award trend (by month)
  const awardTrendQuery = sql`
    SELECT 
      DATE_TRUNC('month', ra.created_at) as month,
      COUNT(ra.id) as award_count,
      SUM(ra.credits_awarded) as credits_awarded
    FROM ${recognitionAwards} ra
    WHERE ra.org_id = ${orgId}
      AND ra.created_at BETWEEN ${startDate} AND ${endDate}
      AND ra.status = 'issued'
    GROUP BY month
    ORDER BY month ASC
  `;

  // Top receivers
  const topReceiversQuery = sql`
    SELECT 
      rwl.user_id,
      om.user_name,
      COUNT(DISTINCT rwl.id) as award_count,
      SUM(rwl.amount) as total_credits
    FROM ${rewardWalletLedger} rwl
    LEFT JOIN organization_members om ON om.user_id = rwl.user_id
    WHERE rwl.org_id = ${orgId}
      AND rwl.created_at BETWEEN ${startDate} AND ${endDate}
      AND rwl.event_type = 'earn'
    GROUP BY rwl.user_id, om.user_name
    ORDER BY award_count DESC
    LIMIT 10
  `;

  // NzilaOS: All DB queries wrapped in RLS context for org isolation (PR-UE-01)
  const [overview, redemption, budgets, topTypes, trend, topReceivers] = await withRLSContext(
    async (tx) => {
      return Promise.all([
        tx.execute(overviewQuery),
        tx.execute(redemptionQuery),
        tx.execute(budgetQuery),
        tx.execute(topAwardTypesQuery),
        tx.execute(awardTrendQuery),
        tx.execute(topReceiversQuery),
      ]);
    },
  );

  return {
    overview: (overview as Array<Record<string, unknown>>)[0] as {
      total_awards: number;
      unique_recipients: number;
      unique_issuers: number;
      total_credits_awarded: number;
      issued_awards: number;
      pending_awards: number;
    },
    redemption: (redemption as Array<Record<string, unknown>>)[0] as {
      total_redemptions: number;
      total_credits_redeemed: number;
      fulfilled_redemptions: number;
    },
    budgets: budgets as Array<Record<string, unknown>>,
    topAwardTypes: topTypes as Array<Record<string, unknown>>,
    awardTrend: trend as Array<Record<string, unknown>>,
    topReceivers: topReceivers as Array<Record<string, unknown>>,
  };
}

export default async function RewardsAnalyticsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  // Check admin role
  const member = await db.query.organizationMembers.findFirst({
    where: (members, { eq, and }) =>
      and(eq(members.userId, userId), eq(members.organizationId, orgId)),
  });

  if (!member || !['admin', 'owner'].includes(member.role)) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.analytics');

  // Date range calculation
  const period = searchParams.period || '30d';
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
  }

  const data = await getAnalyticsData(orgId, startDate, endDate);

  // Calculate engagement rate
  const engagementRate = data.overview.total_awards > 0
    ? ((data.overview.unique_recipients / data.overview.unique_issuers) * 100).toFixed(1)
    : '0';

  // Calculate redemption rate
  const redemptionRate = data.overview.total_credits_awarded > 0
    ? ((data.redemption.total_credits_redeemed / data.overview.total_credits_awarded) * 100).toFixed(1)
    : '0';

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            {period}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              {t('metrics.totalAwards')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.total_awards}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.overview.issued_awards} issued, {data.overview.pending_awards} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {t('metrics.creditsAwarded')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Number(data.overview.total_credits_awarded).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {redemptionRate}% redemption rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('metrics.participation')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.unique_recipients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.overview.unique_issuers} givers, {engagementRate}% engagement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('metrics.redemptions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.redemption.total_redemptions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(data.redemption.total_credits_redeemed).toLocaleString()} credits redeemed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="awards" className="w-full">
        <TabsList>
          <TabsTrigger value="awards">{t('tabs.awards')}</TabsTrigger>
          <TabsTrigger value="budgets">{t('tabs.budgets')}</TabsTrigger>
          <TabsTrigger value="recognition">{t('tabs.recognition')}</TabsTrigger>
        </TabsList>

        {/* Awards Tab */}
        <TabsContent value="awards" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Award Types */}
            <Card>
              <CardHeader>
                <CardTitle>{t('topAwardTypes.title')}</CardTitle>
                <CardDescription>{t('topAwardTypes.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {data.topAwardTypes.map((type: any) => (
                    <div key={type.award_type_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {type.icon && <span className="text-xl">{type.icon}</span>}
                        <span className="font-medium">{type.award_type_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{type.count}x</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(type.total_credits).toLocaleString()} credits
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Receivers */}
            <Card>
              <CardHeader>
                <CardTitle>{t('topReceivers.title')}</CardTitle>
                <CardDescription>{t('topReceivers.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {data.topReceivers.map((receiver: any, index: number) => (
                    <div key={receiver.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{receiver.user_name || 'Unknown'}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{receiver.award_count} awards</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(receiver.total_credits).toLocaleString()} credits
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Budgets Tab */}
        <TabsContent value="budgets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('budgetUsage.title')}</CardTitle>
              <CardDescription>{t('budgetUsage.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.budgets.map((budget: any) => {
                  const usagePercent = (budget.used_credits / budget.total_credits) * 100;
                  return (
                    <div key={budget.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{budget.budget_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {budget.program_name} • {budget.scope_type}
                          </p>
                        </div>
                        <Badge
                          variant={usagePercent > 90 ? 'destructive' : usagePercent > 75 ? 'default' : 'secondary'}
                        >
                          {usagePercent.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {budget.used_credits.toLocaleString()} / {budget.total_credits.toLocaleString()} credits used
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recognition Tab */}
        <TabsContent value="recognition" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('recognition.title')}</CardTitle>
              <CardDescription>{t('recognition.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('recognition.comingSoon')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
