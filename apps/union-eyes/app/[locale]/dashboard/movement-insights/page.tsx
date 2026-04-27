/**
 * Movement Insights Dashboard
 * 
 * Shows anonymized cross-union trends for CLC partnership discussions
 * and movement-wide advocacy.
 * 
 * PRIVACY FEATURES:
 * - No individual organization identifiable
 * - Minimum 5 organizations per trend
 * - Clear privacy disclaimers
 * - Consent status visible
 */


export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { dataAggregationConsent, movementTrends } from '@/db/schema/domains/marketing';
import { eq, and, desc, gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, TrendingDown, Shield, Users, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requireUser } from '@/lib/api-auth-guard';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import Link from 'next/link';

/** Roles permitted to view cross-union movement analytics. */
const MOVEMENT_INSIGHTS_ROLES = [
  'admin', 'president', 'vice_president', 'secretary_treasurer',
  'chief_steward', 'officer', 'national_officer',
  'fed_executive', 'fed_staff',
  'clc_executive', 'clc_staff',
  'system_admin',
] as const;

interface MovementInsightsPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    timeframe?: 'month' | 'quarter' | 'year';
    sector?: string;
    jurisdiction?: string;
  }>;
}

export default async function MovementInsightsPage({
  params,
  searchParams,
}: MovementInsightsPageProps) {
  const { locale } = await params;
  const t = await getTranslations('movementInsightsPage');
  const { timeframe = 'quarter', sector: _sector, jurisdiction: _jurisdiction } = await searchParams;

  // Require officer-level role to view cross-union analytics.
  const user = await requireUser();
  const organizationId = user.organizationId ?? '';
  const userRole = await getUserRoleInOrganization(user.userId, organizationId);
  if (!MOVEMENT_INSIGHTS_ROLES.includes(userRole as typeof MOVEMENT_INSIGHTS_ROLES[number])) {
    redirect('/dashboard');
  }
  
  const [consent] = await db
    .select()
    .from(dataAggregationConsent)
    .where(
      and(
        eq(dataAggregationConsent.organizationId, organizationId),
        eq(dataAggregationConsent.consentGiven, true)
      )
    )
    .limit(1);

  // Get recent trends
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await db
    .select()
    .from(movementTrends)
    .where(
      and(
        eq(movementTrends.timeframe, timeframe),
        gte(movementTrends.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(movementTrends.createdAt));

  // Group trends by type
  const trendsByType = trends.reduce((acc, trend) => {
    if (!acc[trend.category]) {
      acc[trend.category] = [];
    }
    acc[trend.category].push(trend);
    return acc;
  }, {} as Record<string, typeof trends>);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('subtitle')}
            </p>
          </div>

          {!consent && (
            <Button asChild>
              <Link href={`/${locale}/dashboard/settings/data-sharing`}>
                {t('enableDataSharingButton')}
              </Link>
            </Button>
          )}
        </div>

        {/* Privacy Disclaimer */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>{t('privacyFirstTitle')}</AlertTitle>
          <AlertDescription>
            {t('privacyDescriptionPrefix')}{' '}
            <strong>{t('privacyDescriptionStrong')}</strong>{' '}
            {t('privacyDescriptionSuffix')}{' '}
            <Link href={`/${locale}/legal/privacy`} className="underline">
              {t('privacyLearnMoreLink')}
            </Link>
          </AlertDescription>
        </Alert>

        {/* Consent Status */}
        {consent ? (
          <Alert className="border-green-200 bg-green-50">
            <Users className="h-4 w-4 text-green-600" />
            <AlertTitle>{t('consentParticipatingTitle')}</AlertTitle>
            <AlertDescription>
              {t('consentParticipatingDescription')}{' '}
              <Link
                href={`/${locale}/dashboard/settings/data-sharing`}
                className="underline"
              >
                {t('manageConsentPreferencesLink')}
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>{t('consentNotParticipatingTitle')}</AlertTitle>
            <AlertDescription>
              {t('consentNotParticipatingDescription')}{' '}
              <Link
                href={`/${locale}/dashboard/settings/data-sharing`}
                className="underline"
              >
                {t('enableDataSharingLink')}
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filterInsightsTitle')}</CardTitle>
          <CardDescription>
            {t('filterInsightsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('timeframeLabel')}</label>
              <div className="flex gap-2">
                <Link
                  href={`/${locale}/dashboard/movement-insights?timeframe=month`}
                >
                  <Badge variant={timeframe === 'month' ? 'default' : 'outline'}>
                    {t('timeframeMonth')}
                  </Badge>
                </Link>
                <Link
                  href={`/${locale}/dashboard/movement-insights?timeframe=quarter`}
                >
                  <Badge variant={timeframe === 'quarter' ? 'default' : 'outline'}>
                    {t('timeframeQuarter')}
                  </Badge>
                </Link>
                <Link
                  href={`/${locale}/dashboard/movement-insights?timeframe=year`}
                >
                  <Badge variant={timeframe === 'year' ? 'default' : 'outline'}>
                    {t('timeframeYear')}
                  </Badge>
                </Link>
              </div>
            </div>

            {/* Sector filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('sectorLabel')}</label>
              <div className="flex gap-2">
                {['all', 'public', 'private', 'non-profit'].map((s) => (
                  <Link
                    key={s}
                    href={`/${locale}/dashboard/movement-insights?timeframe=${timeframe}&sector=${s === 'all' ? '' : s}`}
                  >
                    <Badge variant={(_sector ?? '') === (s === 'all' ? '' : s) ? 'default' : 'outline'}>
                      {s === 'all'
                        ? t('sectorAll')
                        : s === 'public'
                          ? t('sectorPublic')
                          : s === 'private'
                            ? t('sectorPrivate')
                            : t('sectorNonProfit')}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Cards */}
      {Object.keys(trendsByType).length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('noInsightsTitle')}</AlertTitle>
          <AlertDescription>
            {t('noInsightsDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* Resolution Time Trend */}
      {trendsByType['avg-resolution-time'] && (
        <TrendCard
          title={t('avgResolutionTimeTitle')}
          description={t('avgResolutionTimeDescription')}
          trends={trendsByType['avg-resolution-time']}
          unit={t('unitDays')}
          lowerIsBetter={true}
          icon={<TrendingDown className="h-4 w-4" />}
          t={t}
        />
      )}

      {/* Win Rate Trend */}
      {trendsByType['win-rate'] && (
        <TrendCard
          title={t('memberWinRateTitle')}
          description={t('memberWinRateDescription')}
          trends={trendsByType['win-rate']}
          unit={t('unitPercent')}
          lowerIsBetter={false}
          icon={<TrendingUp className="h-4 w-4" />}
          t={t}
        />
      )}

      {/* Member Satisfaction */}
      {trendsByType['member-satisfaction'] && (
        <TrendCard
          title={t('memberSatisfactionTitle')}
          description={t('memberSatisfactionDescription')}
          trends={trendsByType['member-satisfaction']}
          unit={t('unitOutOfFive')}
          lowerIsBetter={false}
          icon={<TrendingUp className="h-4 w-4" />}
          t={t}
        />
      )}

      {/* Legislative Brief Export */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('exportForAdvocacyTitle')}</CardTitle>
            <CardDescription>
              {t('exportForAdvocacyDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/dashboard/movement-insights/export`}>
                <FileText className="mr-2 h-4 w-4" />
                {t('generateLegislativeBriefButton')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Reusable trend card component
 */
function TrendCard({
  title,
  description,
  trends,
  unit,
  lowerIsBetter,
  icon,
  t,
}: {
  title: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trends: any[];
  unit: string;
  lowerIsBetter: boolean;
  icon: React.ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const latestTrend = trends[0];
  const previousTrend = trends[1];

  let change = 0;
  let changePercent = 0;
  let improving = false;

  if (previousTrend) {
    change = latestTrend.aggregatedValue - previousTrend.aggregatedValue;
    changePercent =
      previousTrend.aggregatedValue !== 0
        ? (change / previousTrend.aggregatedValue) * 100
        : 0;
    
    if (lowerIsBetter) {
      improving = change < 0;
    } else {
      improving = change > 0;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={improving ? 'default' : 'secondary'}>
            {improving ? t('improvingBadge') : t('decliningBadge')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Value */}
          <div>
            <div className="text-4xl font-bold">
              {latestTrend.aggregatedValue.toFixed(1)}
              {unit}
            </div>
            {previousTrend && (
              <div className="text-sm text-muted-foreground mt-1">
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}
                {unit} ({changePercent.toFixed(1)}%) {t('vsPreviousPeriod')}
              </div>
            )}
          </div>

          {/* Data Source */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {t('unionCount', { count: latestTrend.participatingOrgs })}
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {t('caseCount', { count: latestTrend.totalCases.toLocaleString() })}
            </div>
          </div>

          {/* Geographic/Sector Context */}
          <div className="flex gap-2">
            {latestTrend.jurisdiction && (
              <Badge variant="outline">{latestTrend.jurisdiction}</Badge>
            )}
            {latestTrend.sector && (
              <Badge variant="outline">{latestTrend.sector}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
