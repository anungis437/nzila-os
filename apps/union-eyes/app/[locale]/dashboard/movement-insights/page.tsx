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

import { db } from '@/db';
import { dataAggregationConsent, movementTrends } from '@/db/schema/domains/marketing';
import { eq, and, desc, gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, TrendingDown, Shield, Users, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 
 
import Link from 'next/link';

interface MovementInsightsPageProps {
  params: {
    locale: string;
  };
  searchParams: {
    timeframe?: 'month' | 'quarter' | 'year';
    sector?: string;
    jurisdiction?: string;
  };
}

export default async function MovementInsightsPage({
  params,
  searchParams,
}: MovementInsightsPageProps) {
  const { locale } = params;
  const { timeframe = 'quarter', sector: _sector, jurisdiction: _jurisdiction } = searchParams;

  // Get user's organization consent status
  // TODO: Get from session context
  const organizationId = 'org-placeholder';
  
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
            <h1 className="text-4xl font-bold">Movement Insights</h1>
            <p className="text-muted-foreground mt-2">
              Privacy-preserving cross-union trends for advocacy and learning
            </p>
          </div>

          {!consent && (
            <Button asChild>
              <Link href={`/${locale}/dashboard/settings/data-sharing`}>
                Enable Data Sharing
              </Link>
            </Button>
          )}
        </div>

        {/* Privacy Disclaimer */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Privacy-First Design</AlertTitle>
          <AlertDescription>
            All insights are anonymized and aggregated from organizations that have explicitly
            opted in. <strong>Minimum 5 unions and 10 cases required for any trend.</strong>{' '}
            No individual organization can be identified. Statistical noise added to prevent
            reverse engineering.{' '}
            <Link href="/docs/privacy/aggregation" className="underline">
              Learn more about our privacy guarantees
            </Link>
          </AlertDescription>
        </Alert>

        {/* Consent Status */}
        {consent ? (
          <Alert className="border-green-200 bg-green-50">
            <Users className="h-4 w-4 text-green-600" />
            <AlertTitle>Your Organization is Participating</AlertTitle>
            <AlertDescription>
              Thank you for contributing to movement-wide insights. Your data is helping unions
              across the country learn from each other.{' '}
              <Link
                href={`/${locale}/dashboard/settings/data-sharing`}
                className="underline"
              >
                Manage your consent preferences
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Your Organization is Not Participating</AlertTitle>
            <AlertDescription>
              You&apos;re viewing insights from other unions but not contributing. Consider opting in
              to help the movement learn and grow together.{' '}
              <Link
                href={`/${locale}/dashboard/settings/data-sharing`}
                className="underline"
              >
                Enable data sharing
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Insights</CardTitle>
          <CardDescription>
            Explore trends by timeframe, sector, or jurisdiction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeframe</label>
              <div className="flex gap-2">
                <Link
                  href={`/${locale}/dashboard/movement-insights?timeframe=month`}
                >
                  <Badge variant={timeframe === 'month' ? 'default' : 'outline'}>
                    Last Month
                  </Badge>
                </Link>
                <Link
                  href={`/${locale}/dashboard/movement-insights?timeframe=quarter`}
                >
                  <Badge variant={timeframe === 'quarter' ? 'default' : 'outline'}>
                    Last Quarter
                  </Badge>
                </Link>
                <Link
                  href={`/${locale}/dashboard/movement-insights?timeframe=year`}
                >
                  <Badge variant={timeframe === 'year' ? 'default' : 'outline'}>
                    Last Year
                  </Badge>
                </Link>
              </div>
            </div>

            {/* TODO: Add sector and jurisdiction filters */}
          </div>
        </CardContent>
      </Card>

      {/* Trend Cards */}
      {Object.keys(trendsByType).length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Insights Available Yet</AlertTitle>
          <AlertDescription>
            Trends will appear once enough organizations opt in to data sharing. Come back soon!
          </AlertDescription>
        </Alert>
      )}

      {/* Resolution Time Trend */}
      {trendsByType['avg-resolution-time'] && (
        <TrendCard
          title="Average Resolution Time"
          description="How long grievances take to resolve across participating unions"
          trends={trendsByType['avg-resolution-time']}
          unit="days"
          lowerIsBetter={true}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      )}

      {/* Win Rate Trend */}
      {trendsByType['win-rate'] && (
        <TrendCard
          title="Member Win Rate"
          description="Percentage of cases resolved favorably for members"
          trends={trendsByType['win-rate']}
          unit="%"
          lowerIsBetter={false}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      )}

      {/* Member Satisfaction */}
      {trendsByType['member-satisfaction'] && (
        <TrendCard
          title="Member Satisfaction"
          description="How satisfied members are with the grievance process"
          trends={trendsByType['member-satisfaction']}
          unit="/5"
          lowerIsBetter={false}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      )}

      {/* Legislative Brief Export */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Export for Advocacy</CardTitle>
            <CardDescription>
              Generate legislative briefs for union leadership and public advocacy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/dashboard/movement-insights/export`}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Legislative Brief
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
}: {
  title: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trends: any[];
  unit: string;
  lowerIsBetter: boolean;
  icon: React.ReactNode;
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
            {improving ? 'Improving' : 'Declining'}
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
                {unit} ({changePercent.toFixed(1)}%) vs previous period
              </div>
            )}
          </div>

          {/* Data Source */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {latestTrend.participatingOrgs} unions
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {latestTrend.totalCases.toLocaleString()} cases
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
