export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { hasMinRole } from '@/lib/api-auth-guard';
import { requireOrganizationScope } from '@/lib/page-data/organization-scope';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Users, Award, DollarSign } from 'lucide-react';
import { ANALYTICS_PERIODS, loadRewardsAnalytics, parseAnalyticsPeriod, type AnalyticsPeriod } from '@/lib/rewards/analytics-reads';

export const metadata: Metadata = {
  title: 'Analytics & Reporting | Rewards Admin',
  description: 'ROI and performance metrics for recognition programs',
};

export default async function RewardsAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const { organizationId } = await requireOrganizationScope();

  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.analytics');
  const format = await getFormatter();
  const period = parseAnalyticsPeriod((await searchParams).period);

  // A failed read is an error, not a screen of zeros: nothing here catches it.
  const analytics = await loadRewardsAnalytics(organizationId, period);

  const periodLabels: Record<AnalyticsPeriod, string> = {
    '7d': t('period.week'),
    '30d': t('period.month'),
    '90d': t('period.quarter'),
    '1y': t('period.year'),
  };
  const scopeLabels: Record<string, string> = {
    org: t('budgetUsage.scope.org'),
    local: t('budgetUsage.scope.local'),
    department: t('budgetUsage.scope.department'),
    manager: t('budgetUsage.scope.manager'),
  };
  const number = (value: number) => format.number(value);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
        <nav aria-label={t('period.label')} className="flex gap-2">
          {ANALYTICS_PERIODS.map((option) => (
            <Button key={option} variant={option === period ? 'default' : 'outline'} size="sm" asChild>
              <Link
                href={`/${locale}/dashboard/admin/rewards/analytics?period=${option}`}
                aria-current={option === period ? 'page' : undefined}
              >
                {periodLabels[option]}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" aria-hidden="true" />
              {t('metrics.totalAwards')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{number(analytics.awards.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('metrics.totalAwardsDetail', { issued: number(analytics.awards.issued), pending: number(analytics.awards.pending) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
              {t('metrics.creditsAwarded')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{number(analytics.awards.creditsAwarded)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('metrics.creditsAwardedDetail')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              {t('metrics.participation')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{number(analytics.awards.recipients)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('metrics.participationDetail', { givers: analytics.awards.givers })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              {t('metrics.redemptions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{number(analytics.redemptions.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('metrics.redemptionsDetail', { credits: analytics.redemptions.creditsRedeemed })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="awards" className="w-full">
        <TabsList>
          <TabsTrigger value="awards">{t('tabs.awards')}</TabsTrigger>
          <TabsTrigger value="budgets">{t('tabs.budgets')}</TabsTrigger>
        </TabsList>

        {/* Awards Tab */}
        <TabsContent value="awards" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('topAwardTypes.title')}</CardTitle>
                <CardDescription>{t('topAwardTypes.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topAwardTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('topAwardTypes.empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topAwardTypes.map((type) => (
                      <div key={type.id} className="flex items-center justify-between">
                        <span className="font-medium">{type.name}</span>
                        <div className="text-right">
                          <div className="font-bold">{t('awardsCount', { count: type.awards })}</div>
                          <div className="text-xs text-muted-foreground">{t('creditsCount', { count: type.credits })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('topReceivers.title')}</CardTitle>
                <CardDescription>{t('topReceivers.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topReceivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('topReceivers.empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topReceivers.map((receiver, index) => (
                      <div key={receiver.userId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <span className="font-medium">{receiver.name ?? t('unknownMember')}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{t('awardsCount', { count: receiver.awards })}</div>
                          <div className="text-xs text-muted-foreground">{t('creditsCount', { count: receiver.credits })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
              {analytics.budgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('budgetUsage.empty')}</p>
              ) : (
                <div className="space-y-4">
                  {analytics.budgets.map((budget) => {
                    const usagePercent = budget.limit > 0 ? (budget.used / budget.limit) * 100 : 0;
                    return (
                      <div key={budget.id}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium">{budget.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {budget.programName ? `${budget.programName} · ` : ''}
                              {scopeLabels[budget.scope] ?? budget.scope}
                            </p>
                          </div>
                          <Badge variant={usagePercent > 90 ? 'destructive' : usagePercent > 75 ? 'default' : 'secondary'}>
                            {format.number(usagePercent / 100, { style: 'percent', maximumFractionDigits: 0 })}
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
                          {t('budgetUsage.used', { used: number(budget.used), limit: number(budget.limit) })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
