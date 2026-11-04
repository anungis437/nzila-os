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
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
  FileText,
  TrendingUp,
  Calendar,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { CLCApprovalWorkflow } from '@/components/admin/clc-approval-workflow';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { clcOrganizationSyncLog } from '@/db/schema/clc-sync-audit-schema';
import { perCapitaRemittances, remittanceApprovals } from '@/db/schema/clc-per-capita-schema';
import { eq, desc, count, and, sql, lte } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const metadata: Metadata = {
  title: 'CLC Staff Dashboard | UnionEyes',
  description: 'CLC staff operations dashboard - remittance approvals and sync history',
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

interface SyncActivity {
  id: string;
  affiliateCode: string;
  action: string;
  syncedAt: string;
  error: string | null;
}

interface OperationalMetrics {
  failedSyncs: number;
  lastSyncTime: string | null;
  pendingApprovals: number;
  overdueRemittances: number;
  recentActivity: SyncActivity[];
}

// This is a Model A (national/cross-affiliate) dashboard, not Model B
// (org-scoped): getCLCOperationalMetrics() below deliberately ignores
// orgId and returns cross-org aggregates. That is only safe because
// clc_staff/clc_executive/system_admin cannot be self-service granted by
// an ordinary tenant to its own organizationMembers row — proven in
// lib/auth/__tests__/clc-national-role-boundary.test.ts (PR #752 round 5),
// not merely assumed from the role name.
//
// null means the figures could not be read. They are not zero: a failed read must not show as "no failed syncs, nothing awaiting review".
async function getCLCOperationalMetrics(): Promise<OperationalMetrics | null> {
  try {
    // clc_organization_sync_log is SYSTEM_ONLY (nullable organization_id,
    // cross-affiliate sync audit log — see db/rls-storage-authority-manifest.ts).
    // requireUser()+checkCLCStaffAccess() above is the request-facing
    // authorization; the DB execution itself must still go through the
    // system connection, not the ordinary tenant runtime — a SYSTEM_ONLY
    // table may never be read via the ordinary db import regardless of
    // how privileged the caller's role is.
    return await withSystemContext(async (tx) => {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [failedSyncStats] = await tx
        .select({ count: count() })
        .from(clcOrganizationSyncLog)
        .where(
          and(
            eq(clcOrganizationSyncLog.action, 'failed'),
            sql`${clcOrganizationSyncLog.syncedAt} >= ${last24Hours}`
          )
        );

      const [mostRecentSync] = await tx
        .select({ syncedAt: clcOrganizationSyncLog.syncedAt })
        .from(clcOrganizationSyncLog)
        .orderBy(desc(clcOrganizationSyncLog.syncedAt))
        .limit(1);

      const [pendingApprovalStats] = await tx
        .select({ count: count() })
        .from(remittanceApprovals)
        .where(eq(remittanceApprovals.status, 'pending'));

      // Past due and not yet approved or paid
      const today = new Date().toISOString().split('T')[0];
      const [overdueStats] = await tx
        .select({ count: count() })
        .from(perCapitaRemittances)
        .where(
          and(
            lte(perCapitaRemittances.dueDate, today),
            sql`${perCapitaRemittances.status} NOT IN ('paid', 'approved')`
          )
        );

      const recentSyncs = await tx
        .select({
          id: clcOrganizationSyncLog.id,
          affiliateCode: clcOrganizationSyncLog.affiliateCode,
          action: clcOrganizationSyncLog.action,
          syncedAt: clcOrganizationSyncLog.syncedAt,
          error: clcOrganizationSyncLog.error,
        })
        .from(clcOrganizationSyncLog)
        .orderBy(desc(clcOrganizationSyncLog.syncedAt))
        .limit(10);

      return {
        failedSyncs: Number(failedSyncStats?.count ?? 0),
        lastSyncTime: mostRecentSync?.syncedAt ?? null,
        pendingApprovals: Number(pendingApprovalStats?.count ?? 0),
        overdueRemittances: Number(overdueStats?.count ?? 0),
        recentActivity: recentSyncs,
      };
    });
  } catch (error) {
    logger.error('Error fetching CLC operational metrics:', error);
    return null;
  }
}

const DASH = '—';

export default async function CLCStaffDashboardPage() {
  const user = await requireUser();
  const userId = user.userId;
  const orgId = user.organizationId!;

  const hasAccess = await checkCLCStaffAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.staff');
  const metrics = await getCLCOperationalMetrics();

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

      {metrics === null && (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">The operational figures could not be read</p>
            <p className="text-sm">Nothing below is a count: a dash means the figure was not read. Reload the page to try again.</p>
          </div>
        </div>
      )}

      {/* Operational Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Syncs (24h)</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics === null ? DASH : metrics.failedSyncs}</div>
            {metrics !== null && (
              <p className="text-xs text-muted-foreground">
                {metrics.failedSyncs > 0 ? (
                  <span className="text-red-600 font-medium">Check the recent activity below</span>
                ) : (
                  <span className="text-green-600">No failed syncs recorded</span>
                )}
              </p>
            )}
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
              {metrics === null || metrics.lastSyncTime === null ? DASH : new Date(metrics.lastSyncTime).toLocaleDateString()}
            </div>
            {metrics !== null && metrics.lastSyncTime === null && (
              <p className="text-xs text-muted-foreground">No sync has been recorded</p>
            )}
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
            <div className="text-2xl font-bold">{metrics === null ? DASH : metrics.pendingApprovals}</div>
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
            <div className="text-2xl font-bold">{metrics === null ? DASH : metrics.overdueRemittances}</div>
            {metrics !== null && (
              <p className="text-xs text-muted-foreground">
                {metrics.overdueRemittances > 0 ? (
                  <span className="text-orange-600">{t('metrics.requiresFollowUp', { defaultValue: 'Requires follow-up' })}</span>
                ) : (
                  <span className="text-green-600">{t('metrics.allOnTrack', { defaultValue: 'All on track' })}</span>
                )}
              </p>
            )}
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
        </div>
        <CLCApprovalWorkflow />
      </div>

      {/* Sync history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('activity.title', { defaultValue: 'Recent Activity' })}
          </CardTitle>
          <CardDescription>
            {t('activity.description', { defaultValue: 'Latest affiliate sync operations' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics === null ? (
            <p className="text-center py-8 text-muted-foreground">{DASH}</p>
          ) : metrics.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('activity.noActivity', { defaultValue: 'No recent activity' })}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{activity.affiliateCode}</div>
                    <div className="text-sm text-muted-foreground">{new Date(activity.syncedAt).toLocaleString()}</div>
                    {activity.error !== null && <div className="text-sm text-red-700">{activity.error}</div>}
                  </div>
                  <Badge variant={activity.action === 'failed' ? 'destructive' : 'default'}>{activity.action}</Badge>
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
              <Link href="/dashboard/admin/organizations">
                <Users className="mr-2 h-4 w-4" />
                {t('quickLinks.organizations', { defaultValue: 'Organization Admin' })}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
