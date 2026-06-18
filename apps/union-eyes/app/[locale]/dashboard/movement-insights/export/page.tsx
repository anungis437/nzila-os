/**
 * Legislative Brief Export Page
 * 
 * Generate PDF briefs for union advocacy based on movement insights.
 *
 * GATED: Same officer-level role requirement as the parent movement-insights
 * page. requireUser() call here makes the data access explicit even though
 * dashboard/layout.tsx also enforces authentication.
 */


export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { movementTrends } from '@/db/schema/domains/marketing';
import { gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Shield } from 'lucide-react';
import { generateLegislativeBrief } from '@/lib/movement-insights/aggregation-service';
import { MovementTrend } from '@/types/marketing';
import { requireUser } from '@/lib/api-auth-guard';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import Link from 'next/link';

/** Roles permitted to export cross-union legislative briefs (mirrors movement-insights). */
const MOVEMENT_INSIGHTS_ROLES = [
  'admin', 'president', 'vice_president', 'secretary_treasurer',
  'chief_steward', 'officer', 'national_officer',
  'fed_executive', 'fed_staff',
  'clc_executive', 'clc_staff',
  'system_admin',
] as const;

interface ExportPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    focusArea?: string;
    jurisdiction?: string;
    timeframe?: string;
  }>;
}

export async function generateMetadata({ params }: Pick<ExportPageProps, 'params'>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'movementInsightsExportPage.metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LegislativeBriefExportPage({
  params,
  searchParams,
}: ExportPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'movementInsightsExportPage' });
  const { focusArea = 'Workplace Dispute Resolution', jurisdiction, timeframe: _timeframe = 'quarter' } = await searchParams;

  // Role gate — same requirement as the parent movement-insights page.
  const user = await requireUser();
  const organizationId = user.organizationId ?? '';
  const userRole = await getUserRoleInOrganization(user.userId, organizationId);
  if (!MOVEMENT_INSIGHTS_ROLES.includes(userRole as typeof MOVEMENT_INSIGHTS_ROLES[number])) {
    redirect('/dashboard');
  }

  // Get relevant trends
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await db
    .select()
    .from(movementTrends)
    .where(
      gte(movementTrends.createdAt, thirtyDaysAgo)
    )
    .orderBy(movementTrends.createdAt);

  // Note: jurisdiction column doesn't exist on movementTrends; filtering removed
  const filteredTrends = trends as any as MovementTrend[];

  // Generate brief
  const brief = generateLegislativeBrief(filteredTrends, focusArea);

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">{t('header.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('header.description')}
          </p>
        </div>

        <Button asChild>
          <Link href={`/${locale}/dashboard/movement-insights`}>
            {t('header.backToInsights')}
          </Link>
        </Button>
      </div>

      {/* Brief Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{brief.title}</CardTitle>
              <CardDescription className="mt-2">
                {brief.summary}
              </CardDescription>
            </div>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              {t('preview.exportPdf')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Findings */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('preview.keyFindings')}</h3>
            <ul className="space-y-2">
              {brief.keyFindings.map((finding, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="mt-0.5">
                    {index + 1}
                  </Badge>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          {brief.recommendations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">{t('preview.recommendations')}</h3>
              <ul className="space-y-2">
                {brief.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Badge variant="default" className="mt-0.5">
                      {index + 1}
                    </Badge>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Source */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 mt-0.5" />
              <div>
                <strong>{t('preview.dataSourceLabel')}</strong> {brief.dataSource}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization Options */}
      <Card>
        <CardHeader>
          <CardTitle>{t('customize.title')}</CardTitle>
          <CardDescription>
            {t('customize.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('customize.focusAreaLabel')}</label>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={focusArea === 'Workplace Dispute Resolution' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.focusAreaOptions.workplaceDisputes')}
                </Badge>
                <Badge 
                  variant={focusArea === 'Healthcare' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.focusAreaOptions.healthcare')}
                </Badge>
                <Badge 
                  variant={focusArea === 'Education' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.focusAreaOptions.education')}
                </Badge>
                <Badge 
                  variant={focusArea === 'Public Sector' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.focusAreaOptions.publicSector')}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('customize.jurisdictionLabel')}</label>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={!jurisdiction ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.jurisdictionOptions.allCanada')}
                </Badge>
                <Badge 
                  variant={jurisdiction === 'ON' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.jurisdictionOptions.ontario')}
                </Badge>
                <Badge 
                  variant={jurisdiction === 'BC' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  BC
                </Badge>
                <Badge 
                  variant={jurisdiction === 'QC' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {t('customize.jurisdictionOptions.quebec')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('usage.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>{t('usage.unionLeadership.label')}</strong> {t('usage.unionLeadership.text')}
          </p>
          <p>
            <strong>{t('usage.clcAdvocacy.label')}</strong> {t('usage.clcAdvocacy.text')}
          </p>
          <p>
            <strong>{t('usage.mediaRelations.label')}</strong> {t('usage.mediaRelations.text')}
          </p>
          <p className="text-muted-foreground">
            <strong>{t('usage.note.label')}</strong> {t('usage.note.text')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
