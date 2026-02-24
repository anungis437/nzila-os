export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Award, 
  Coins, 
  TrendingUp, 
  Users, 
  Gift,
  Settings,
  BarChart3,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { getRewardsSummary } from '@/actions/rewards-actions';
import { db } from '@/db';

export const metadata: Metadata = {
  title: 'Recognition & Rewards Admin | Union Eyes',
  description: 'Manage recognition programs, awards, and budgets',
};

async function checkAdminRole(userId: string, orgId: string): Promise<boolean> {
  try {
    // Query organizationMembers table to check if user has admin role
    const member = await db.query.organizationMembers.findFirst({
      where: (organizationMembers, { eq, and }) =>
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, orgId)
        ),
    });

    return member?.role === 'admin';
  } catch (_error) {
return false;
  }
}

export default async function AdminRewardsPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const isAdmin = await checkAdminRole(userId, orgId);
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin');

  // Fetch summary metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = await getRewardsSummary() as { success: boolean; data?: Record<string, any>; error?: string };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('overview.title', { defaultValue: 'Recognition & Rewards Administration' })}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('overview.description', {
            defaultValue: 'Manage recognition programs, approve awards, and track budget allocations',
          })}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.activePrograms', { defaultValue: 'Active Programs' })}
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.success ? summary.data?.active_programs_count || 0 : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.programsSubtext', { defaultValue: 'Recognition programs' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.pendingApprovals', { defaultValue: 'Pending Approvals' })}
            </CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.success ? summary.data?.pending_awards_count || 0 : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.approvalsSubtext', { defaultValue: 'Awards awaiting review' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.totalIssued', { defaultValue: 'Total Issued' })}
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.success
                ? (summary.data?.total_credits_issued || 0).toLocaleString()
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.issuedSubtext', { defaultValue: 'Credits issued' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('metrics.totalRedeemed', { defaultValue: 'Total Redeemed' })}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.success
                ? (summary.data?.total_credits_redeemed || 0).toLocaleString()
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('metrics.redeemedSubtext', { defaultValue: 'Credits redeemed' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {t('quickActions.title', { defaultValue: 'Quick Actions' })}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <Link href="/dashboard/admin/rewards/programs">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t('quickActions.programs.title', { defaultValue: 'Manage Programs' })}
                    </CardTitle>
                    <CardDescription>
                      {t('quickActions.programs.description', {
                        defaultValue: 'Create and configure recognition programs',
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <Link href="/dashboard/admin/rewards/awards">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t('quickActions.awards.title', { defaultValue: 'Review Awards' })}
                    </CardTitle>
                    <CardDescription>
                      {t('quickActions.awards.description', {
                        defaultValue: 'Approve and issue recognition awards',
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <Link href="/dashboard/admin/rewards/budgets">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t('quickActions.budgets.title', { defaultValue: 'Manage Budgets' })}
                    </CardTitle>
                    <CardDescription>
                      {t('quickActions.budgets.description', {
                        defaultValue: 'Allocate and track budget envelopes',
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <Link href="/dashboard/admin/rewards/shopify">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t('quickActions.shopify.title', { defaultValue: 'Shopify Config' })}
                    </CardTitle>
                    <CardDescription>
                      {t('quickActions.shopify.description', {
                        defaultValue: 'Configure Shop Moi Ã‡a integration',
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <Link href="/dashboard/admin/rewards/reports">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t('quickActions.reports.title', { defaultValue: 'View Reports' })}
                    </CardTitle>
                    <CardDescription>
                      {t('quickActions.reports.description', {
                        defaultValue: 'Analytics and insights dashboard',
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <Link href="/dashboard/admin/rewards/members">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {t('quickActions.members.title', { defaultValue: 'Member Wallets' })}
                    </CardTitle>
                    <CardDescription>
                      {t('quickActions.members.description', {
                        defaultValue: 'View member balances and history',
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('recentActivity.title', { defaultValue: 'Recent Activity' })}
          </CardTitle>
          <CardDescription>
            {t('recentActivity.description', {
              defaultValue: 'Latest awards and redemptions across the organization',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>
              {t('recentActivity.placeholder', {
                defaultValue: 'Activity feed coming soon',
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
