export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
  FileText,
  TrendingUp,
  Calendar,
  Settings,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { CLCApprovalWorkflow } from '@/components/admin/clc-approval-workflow';
import { db } from '@/db';
import { clcOrganizationSyncLog } from '@/db/schema/clc-sync-audit-schema';
import { perCapitaRemittances, remittanceApprovals } from '@/db/schema/clc-per-capita-schema';
import { eq, desc, count, and, sql, lte } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const metadata: Metadata = {
  title: 'CLC Staff Dashboard | Union Eyes',
  description: 'CLC staff operations dashboard - sync, remittances, and operational support',
};

async function checkCLCStaffAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    // Allow clc_staff, clc_executive, and system_admin roles
    return ['clc_staff', 'clc_executive', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}

async function getCLCOperationalMetrics(_orgId: string) {
  try {
    // Query sync log for failed syncs in last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [failedSyncStats] = await db
      .select({ count: count() })
      .from(clcOrganizationSyncLog)
      .where(
        and(
          eq(clcOrganizationSyncLog.action, 'failed'),
          sql`${clcOrganizationSyncLog.syncedAt} >= ${last24Hours}`
        )
      );

    // Get most recent sync
    const [mostRecentSync] = await db
      .select({
        syncedAt: clcOrganizationSyncLog.syncedAt,
        action: clcOrganizationSyncLog.action,
      })
      .from(clcOrganizationSyncLog)
      .orderBy(desc(clcOrganizationSyncLog.syncedAt))
      .limit(1);

    // Count pending approvals
    const [pendingApprovalStats] = await db
      .select({ count: count() })
      .from(remittanceApprovals)
      .where(eq(remittanceApprovals.status, 'pending'));

    // Count overdue remittances (past due date and not paid)
    const today = new Date().toISOString().split('T')[0];
    const [overdueStats] = await db
      .select({ count: count() })
      .from(perCapitaRemittances)
      .where(
        and(
          lte(perCapitaRemittances.dueDate, today),
          sql`${perCapitaRemittances.status} NOT IN ('paid', 'approved')`
        )
      );

    // Get recent sync activity (last 10 syncs)
    const recentSyncs = await db
      .select({
        id: clcOrganizationSyncLog.id,
        affiliateCode: clcOrganizationSyncLog.affiliateCode,
        action: clcOrganizationSyncLog.action,
        duration: clcOrganizationSyncLog.duration,
        syncedAt: clcOrganizationSyncLog.syncedAt,
        error: clcOrganizationSyncLog.error,
      })
      .from(clcOrganizationSyncLog)
      .orderBy(desc(clcOrganizationSyncLog.syncedAt))
      .limit(10);

    return {
      pendingSyncs: 0, // This would need a separate queue table to track
      failedSyncs: failedSyncStats?.count || 0,
      lastSyncTime: mostRecentSync?.syncedAt || null,
      pendingApprovals: pendingApprovalStats?.count || 0,
      overdueRemittances: overdueStats?.count || 0,
      recentActivity: recentSyncs || [],
    };
  } catch (error) {
    logger.error('Error fetching CLC operational metrics:', error);
    return {
      pendingSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null,
      pendingApprovals: 0,
      overdueRemittances: 0,
      recentActivity: [],
    };
  }
}

export default async function CLCStaffDashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const hasAccess = await checkCLCStaffAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.staff');
  const metrics = await getCLCOperationalMetrics(orgId);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8 text-blue-600" />
            {t('dashboard.title', { defaultValue: 'CLC Staff Dashboard' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('dashboard.description', { 
              defaultValue: 'National operations, affiliate synchronization, and remittance processing' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/clc">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('dashboard.executiveDashboard', { defaultValue: 'Executive Dashboard' })}
            </Link>
          </Button>
        </div>
      </div>

      {/* Operational Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.pendingSyncs', { defaultValue: 'Pending Syncs' })}
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingSyncs}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.failedSyncs > 0 && (
                <span className="text-red-600 font-medium">
                  {metrics.failedSyncs} failed
                </span>
              )}
              {metrics.failedSyncs === 0 && (
                <span className="text-green-600">All syncs successful</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.lastSync', { defaultValue: 'Last Sync' })}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.lastSyncTime ? new Date(metrics.lastSyncTime).toLocaleDateString() : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.syncStatus', { defaultValue: 'Automated daily sync' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.pendingApprovals', { defaultValue: 'Pending Approvals' })}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.remittancesAwaitingReview', { defaultValue: 'Remittances awaiting review' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.overdueRemittances', { defaultValue: 'Overdue Remittances' })}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overdueRemittances}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.overdueRemittances > 0 ? (
                <span className="text-orange-600">{t('metrics.requiresFollowUp', { defaultValue: 'Requires follow-up' })}</span>
              ) : (
                <span className="text-green-600">{t('metrics.allOnTrack', { defaultValue: 'All on track' })}</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Operations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Affiliate Sync Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {t('sync.title', { defaultValue: 'Affiliate Synchronization' })}
            </CardTitle>
            <CardDescription>
              {t('sync.description', { defaultValue: 'Manage data sync between CLC and affiliate systems' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{t('sync.manualSync', { defaultValue: 'Manual Sync' })}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('sync.manualSyncDesc', { defaultValue: 'Trigger immediate affiliate data sync' })}
                  </div>
                </div>
                <Button size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('sync.syncNow', { defaultValue: 'Sync Now' })}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{t('sync.syncLogs', { defaultValue: 'View Sync Logs' })}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('sync.syncLogsDesc', { defaultValue: 'Review sync history and errors' })}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/admin/clc-sync-logs">
                    {t('sync.viewLogs', { defaultValue: 'View Logs' })}
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{t('sync.syncSettings', { defaultValue: 'Sync Settings' })}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('sync.syncSettingsDesc', { defaultValue: 'Configure sync schedules and mappings' })}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/admin/settings/clc-sync">
                    {t('sync.configure', { defaultValue: 'Configure' })}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remittance Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t('remittances.title', { defaultValue: 'Remittance Processing' })}
            </CardTitle>
            <CardDescription>
              {t('remittances.description', { defaultValue: 'Review and process per-capita remittances' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{t('remittances.reviewQueue', { defaultValue: 'Review Queue' })}</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.pendingApprovals} {t('remittances.pending', { defaultValue: 'pending review' })}
                  </div>
                </div>
                <Button size="sm" asChild>
                  <Link href="/dashboard/admin/clc-remittances">
                    {t('remittances.review', { defaultValue: 'Review' })}
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{t('remittances.overdueFollowUp', { defaultValue: 'Overdue Follow-up' })}</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.overdueRemittances} {t('remittances.overdueItems', { defaultValue: 'overdue items' })}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/admin/clc-remittances?filter=overdue">
                    {t('remittances.followUp', { defaultValue: 'Follow Up' })}
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{t('remittances.bulkImport', { defaultValue: 'Bulk Import' })}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('remittances.bulkImportDesc', { defaultValue: 'Import remittance data from CSV' })}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/admin/clc-remittances/import">
                    {t('remittances.import', { defaultValue: 'Import' })}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Workflow */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckCircle className="h-6 w-6" />
            {t('workflow.title', { defaultValue: 'Approval Workflow' })}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('workflow.description', { defaultValue: 'Review and approve pending remittances' })}
          </p>
        </div>
        <CLCApprovalWorkflow
          {...{
            organizationId: orgId,
            onApprove: async (id: string) => {
              'use server';
              // TODO: Implement approval logic
              logger.info('Approved', { id });
            },
            onReject: async (id: string) => {
              'use server';
              // TODO: Implement rejection logic
              logger.info('Rejected', { id });
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any}
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('activity.title', { defaultValue: 'Recent Activity' })}
          </CardTitle>
          <CardDescription>
            {t('activity.description', { defaultValue: 'Latest sync operations and remittance processing' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('activity.noActivity', { defaultValue: 'No recent activity' })}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(metrics.recentActivity as any[]).map((activity: { description: string; timestamp: string; status: string }, index: number) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{activity.description}</div>
                    <div className="text-sm text-muted-foreground">{activity.timestamp}</div>
                  </div>
                  <Badge variant={activity.status === 'success' ? 'default' : 'destructive'}>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickLinks.title', { defaultValue: 'Quick Links' })}</CardTitle>
          <CardDescription>
            {t('quickLinks.description', { defaultValue: 'Common staff operations and resources' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/clc/affiliates">
                <Building2 className="mr-2 h-4 w-4" />
                {t('quickLinks.manageAffiliates', { defaultValue: 'Manage Affiliates' })}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/clc/compliance">
                <FileText className="mr-2 h-4 w-4" />
                {t('quickLinks.compliance', { defaultValue: 'Compliance Reports' })}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/admin/clc-analytics">
                <TrendingUp className="mr-2 h-4 w-4" />
                {t('quickLinks.analytics', { defaultValue: 'View Analytics' })}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/admin/organizations">
                <Users className="mr-2 h-4 w-4" />
                {t('quickLinks.organizations', { defaultValue: 'Organization Admin' })}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/admin/settings">
                <Settings className="mr-2 h-4 w-4" />
                {t('quickLinks.settings', { defaultValue: 'System Settings' })}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/cross-union-analytics">
                <Database className="mr-2 h-4 w-4" />
                {t('quickLinks.crossUnion', { defaultValue: 'Cross-Union Data' })}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
