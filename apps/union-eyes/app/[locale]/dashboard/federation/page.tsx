export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  DollarSign, 
  AlertCircle,
  FileText,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { hasFederationAccess } from '@/lib/organizations/federation-access';
import { listAffiliates } from '@/lib/organizations/affiliates';
import { loadRemittanceMetrics } from '@/lib/organizations/per-capita-standing';

export const metadata: Metadata = {
  title: 'Federation Dashboard | UnionEyes',
  description: 'Provincial federation executive dashboard and analytics',
};

/**
 * The federation's member unions (a system read, authorized by the caller's administrative standing over the organization) and the
 * per-capita remittances addressed to it (read in its own context). A failed read is an error: it must not render as a federation
 * with no affiliates and nothing owed.
 */
async function getFederationMetrics(userId: string, orgId: string) {
  const [memberUnions, remittances] = await Promise.all([
    listAffiliates({ userId, organizationId: orgId }),
    loadRemittanceMetrics(orgId),
  ]);
  return {
    totalMemberUnions: memberUnions.length,
    totalMembers: remittances.totalMembers,
    pendingRemittances: remittances.pendingRemittances,
    overdueRemittances: remittances.overdueRemittances,
    memberUnions,
  };
}

export default async function FederationDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser();
  const userId = user.userId;
  const orgId = user.organizationId;
  if (!orgId || !(await hasFederationAccess(userId, orgId))) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('federation');
  const metrics = await getFederationMetrics(userId, orgId);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {t('dashboard.title', { defaultValue: 'Federation Dashboard' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('dashboard.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${locale}/dashboard/federation/remittances`}>
              <FileText className="mr-2 h-4 w-4" />
              {t('dashboard.viewRemittances', { defaultValue: 'Remittances' })}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/${locale}/dashboard/federation/affiliates`}>
              <Users className="mr-2 h-4 w-4" />
              {t('dashboard.manageAffiliates')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.memberUnions', { defaultValue: 'Member Unions' })}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMemberUnions}</div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.affiliateSubtext', { defaultValue: 'Affiliated locals and unions' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.totalMembers', { defaultValue: 'Total Members' })}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalMembers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.memberSubtext', { defaultValue: 'Across all affiliates' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.pendingRemittances', { defaultValue: 'Pending Remittances' })}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingRemittances}</div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.remittanceSubtext', { defaultValue: 'Awaiting submission' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.overdueRemittances', { defaultValue: 'Overdue' })}
            </CardTitle>
            <AlertCircle className={`h-4 w-4 ${metrics.overdueRemittances > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.overdueRemittances > 0 ? 'text-destructive' : ''}`}>
              {metrics.overdueRemittances}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.overdueSubtext', { defaultValue: 'Past due date' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {metrics.overdueRemittances > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('alerts.overdue.title', { defaultValue: 'Action Required: Overdue Remittances' })}
            </CardTitle>
            <CardDescription>
              {t('alerts.overdue.description', { 
                count: metrics.overdueRemittances,
                defaultValue: `${metrics.overdueRemittances} remittance(s) are past due. Please follow up with affected locals.` 
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" asChild>
              <Link href={`/${locale}/dashboard/federation/remittances`}>
                {t('alerts.overdue.action', { defaultValue: 'View Overdue Remittances' })}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('quickActions.affiliates.title')}
            </CardTitle>
            <CardDescription>
              {t('quickActions.affiliates.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href={`/${locale}/dashboard/federation/affiliates`}>
                <Building2 className="mr-2 h-4 w-4" />
                {t('quickActions.affiliates.viewAll', { defaultValue: 'View All Affiliates' })}
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href={`/${locale}/dashboard/cross-union-analytics`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                {t('quickActions.affiliates.analytics', { defaultValue: 'Cross-Union Analytics' })}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t('quickActions.remittances.title')}
            </CardTitle>
            <CardDescription>
              {t('quickActions.remittances.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href={`/${locale}/dashboard/federation/remittances`}>
                <FileText className="mr-2 h-4 w-4" />
                {t('quickActions.remittances.viewAll')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Member Unions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('recentAffiliates.title', { defaultValue: 'Member Unions' })}
          </CardTitle>
          <CardDescription>
            {t('recentAffiliates.description', { 
              defaultValue: 'Overview of affiliated locals and unions' 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.memberUnions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('recentAffiliates.empty', { defaultValue: 'No affiliated unions found' })}</p>
              <Button className="mt-4" variant="outline" asChild>
                <Link href={`/${locale}/dashboard/federation/affiliates`}>
                  {t('recentAffiliates.manageAction')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.memberUnions.slice(0, 5).map((union) => (
                <div key={union.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <div className="font-medium">{union.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {union.clcAffiliateCode && (
                        <Badge variant="outline" className="mr-2">
                          {union.clcAffiliateCode}
                        </Badge>
                      )}
                      {union.organizationType && (
                        <span className="capitalize">{union.organizationType}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${locale}/dashboard/federation/affiliates?q=${encodeURIComponent(union.name)}`}>
                      {t('recentAffiliates.viewDetails', { defaultValue: 'View' })}
                    </Link>
                  </Button>
                </div>
              ))}
              {metrics.memberUnions.length > 5 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/${locale}/dashboard/federation/affiliates`}>
                    {t('recentAffiliates.viewAll', { 
                      count: metrics.memberUnions.length,
                      defaultValue: `View All ${metrics.memberUnions.length} Affiliates` 
                    })}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
