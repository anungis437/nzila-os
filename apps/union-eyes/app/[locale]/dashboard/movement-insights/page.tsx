/**
 * Movement Trends
 *
 * Shows the aggregated cross-union trends stored in movement_trends and whether this organization's data-sharing consent
 * is on record. The trends are produced outside this application: the page displays the stored rows as they are
 * (category, dimension, timeframe, count, contributing organizations, summary) and calculates nothing from them.
 *
 * Consent cannot be recorded or withdrawn from this application (see settings/data-sharing), so the page links to the
 * read-only status and offers no way to opt in.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { desc, gte } from 'drizzle-orm';
import { AlertCircle, Shield, Users } from 'lucide-react';
import { db } from '@/db';
import { movementTrends } from '@/db/schema/domains/marketing';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/api-auth-guard';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { movementTrendCategoryLabel } from '@/lib/movement-insights/category-labels';
import { readOrganizationConsent } from '@/lib/movement-insights/consent-read';

/** Roles permitted to view cross-union movement analytics. */
const MOVEMENT_INSIGHTS_ROLES = [
  'admin', 'president', 'vice_president', 'secretary_treasurer',
  'chief_steward', 'officer', 'national_officer',
  'fed_executive', 'fed_staff',
  'clc_executive', 'clc_staff',
  'system_admin',
] as const;

const COPY = {
  en: {
    subtitle: 'Aggregated cross-union trends, stored for advocacy and learning',
    aboutTitle: 'What this page shows',
    about:
      'The trends stored in the last 30 days. A stored trend carries a count of contributing organizations, not their names or identifiers. This page does not calculate the trends or check how they were produced.',
    privacyPolicy: 'Privacy Policy',
    consentOnRecordTitle: 'Consent on record for your organization',
    consentOnRecord: 'Your organization has consented to contribute to movement insights.',
    noConsentTitle: 'No consent on record for your organization',
    noConsent: 'You are viewing trends from other unions. Your organization has not consented to contribute.',
    viewStatus: 'View consent status',
    filterDescription: 'Show the stored trends for one timeframe.',
    allTimeframes: 'All',
    noTrendsTitle: 'No stored trends',
    noTrends: 'No trends were stored in the last 30 days.',
    noTrendsForTimeframe: 'No trend stored in the last 30 days has this timeframe.',
    count: 'Count',
    organizations: 'Contributing organizations',
    confidence: 'Confidence',
    emerging: 'Emerging pattern',
    confidenceLevels: { low: 'Low', medium: 'Medium', high: 'High' } as Partial<Record<string, string>>,
  },
  fr: {
    subtitle: 'Tendances agrégées entre syndicats, conservées pour la défense des droits et l’apprentissage',
    aboutTitle: 'Ce que montre cette page',
    about:
      'Les tendances conservées au cours des 30 derniers jours. Une tendance conservée comporte le nombre d’organisations contributrices, et non leur nom ou leur identifiant. Cette page ne calcule pas les tendances et ne vérifie pas comment elles ont été produites.',
    privacyPolicy: 'Politique de confidentialité',
    consentOnRecordTitle: 'Consentement enregistré pour votre organisation',
    consentOnRecord: 'Votre organisation a consenti à contribuer aux analyses du mouvement.',
    noConsentTitle: 'Aucun consentement enregistré pour votre organisation',
    noConsent: 'Vous consultez les tendances d’autres syndicats. Votre organisation n’a pas consenti à contribuer.',
    viewStatus: 'Voir l’état du consentement',
    filterDescription: 'Afficher les tendances conservées pour une seule période.',
    allTimeframes: 'Toutes',
    noTrendsTitle: 'Aucune tendance conservée',
    noTrends: 'Aucune tendance n’a été conservée au cours des 30 derniers jours.',
    noTrendsForTimeframe: 'Aucune tendance conservée au cours des 30 derniers jours n’a cette période.',
    count: 'Compte',
    organizations: 'Organisations contributrices',
    confidence: 'Niveau de confiance',
    emerging: 'Tendance émergente',
    confidenceLevels: { low: 'Faible', medium: 'Moyen', high: 'Élevé' } as Partial<Record<string, string>>,
  },
} as const;

type Language = keyof typeof COPY;

interface MovementInsightsPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    timeframe?: string | string[];
  }>;
}

export default async function MovementInsightsPage({
  params,
  searchParams,
}: MovementInsightsPageProps) {
  const { locale } = await params;
  const { timeframe: requestedTimeframe } = await searchParams;
  const t = await getTranslations('movementInsightsPage');
  const language: Language = locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const copy = COPY[language];
  const timeframe = typeof requestedTimeframe === 'string' && requestedTimeframe !== '' ? requestedTimeframe : undefined;

  // Require officer-level role to view cross-union analytics.
  const user = await requireUser();
  const organizationId = user.organizationId;
  if (!organizationId) {
    redirect('/dashboard');
  }
  const userRole = await getUserRoleInOrganization(user.userId, organizationId);
  if (!MOVEMENT_INSIGHTS_ROLES.includes(userRole as typeof MOVEMENT_INSIGHTS_ROLES[number])) {
    redirect('/dashboard');
  }

  // The organization's own consent record, read in its own context.
  const consent = (await readOrganizationConsent(organizationId))?.consentGiven ? true : null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await db
    .select()
    .from(movementTrends)
    .where(gte(movementTrends.createdAt, thirtyDaysAgo))
    .orderBy(desc(movementTrends.createdAt));

  // The filter offers the timeframes that are stored, so every option it shows matches at least one trend.
  const timeframes = [...new Set(trends.map((trend) => trend.timeframe))];
  const shown = timeframe ? trends.filter((trend) => trend.timeframe === timeframe) : trends;
  const trendsByCategory = new Map<string, typeof trends>();
  for (const trend of shown) {
    trendsByCategory.set(trend.category, [...(trendsByCategory.get(trend.category) ?? []), trend]);
  }

  const numberLocale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const statusHref = `/${locale}/dashboard/settings/data-sharing`;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-4xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{copy.subtitle}</p>
        </div>

        <Alert role="note">
          <Shield aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>{copy.aboutTitle}</AlertTitle>
          <AlertDescription>
            {copy.about}{' '}
            <Link href={`/${locale}/legal/privacy`} className="underline">
              {copy.privacyPolicy}
            </Link>
          </AlertDescription>
        </Alert>

        {consent ? (
          <Alert role="note" className="border-green-200 bg-green-50">
            <Users aria-hidden="true" className="h-4 w-4 text-green-600" />
            <AlertTitle>{copy.consentOnRecordTitle}</AlertTitle>
            <AlertDescription>
              {copy.consentOnRecord}{' '}
              <Link href={statusHref} className="underline">
                {copy.viewStatus}
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="note" className="border-yellow-200 bg-yellow-50">
            <AlertCircle aria-hidden="true" className="h-4 w-4 text-yellow-600" />
            <AlertTitle>{copy.noConsentTitle}</AlertTitle>
            <AlertDescription>
              {copy.noConsent}{' '}
              <Link href={statusHref} className="underline">
                {copy.viewStatus}
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {timeframes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('filterInsightsTitle')}</CardTitle>
            <CardDescription>{copy.filterDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{t('timeframeLabel')}</span>
              <Link href={`/${locale}/dashboard/movement-insights`}>
                <Badge variant={timeframe ? 'outline' : 'default'}>{copy.allTimeframes}</Badge>
              </Link>
              {timeframes.map((value) => (
                <Link key={value} href={`/${locale}/dashboard/movement-insights?timeframe=${encodeURIComponent(value)}`}>
                  <Badge variant={timeframe === value ? 'default' : 'outline'}>{value}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {shown.length === 0 && (
        <Alert role="status">
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>{copy.noTrendsTitle}</AlertTitle>
          <AlertDescription>{timeframe ? copy.noTrendsForTimeframe : copy.noTrends}</AlertDescription>
        </Alert>
      )}

      {[...trendsByCategory].map(([category, rows]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{movementTrendCategoryLabel(category, language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rows.map((trend) => (
                <li key={trend.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{trend.dimension}</span>
                    <Badge variant="outline">{trend.timeframe}</Badge>
                    {trend.emergingPattern && <Badge>{copy.emerging}</Badge>}
                  </div>
                  <p className="text-sm">{trend.insights}</p>
                  <p className="text-xs text-muted-foreground">
                    {copy.count}: {trend.aggregatedCount.toLocaleString(numberLocale)} · {copy.organizations}:{' '}
                    {trend.organizationsContributing.toLocaleString(numberLocale)} · {copy.confidence}:{' '}
                    {copy.confidenceLevels[trend.confidenceLevel] ?? trend.confidenceLevel}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
