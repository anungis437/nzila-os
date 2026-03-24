export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { listAwardsByStatus } from '@/actions/rewards-actions';
import { AwardsQueue } from '@/components/rewards/admin/awards-queue';
import { CreateAwardDialog } from '@/components/rewards/admin/create-award-dialog';

export const metadata: Metadata = {
  title: 'Awards Management | Admin',
  description: 'Approve and issue recognition awards',
};

export default async function AdminAwardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  await requireUser();
  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.awards');
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.status || 'pending';

  // Fetch awards by status
  const pendingResult = await listAwardsByStatus({ statuses: ['pending'] });
  const approvedResult = await listAwardsByStatus({ statuses: ['approved'] });
  const issuedResult = await listAwardsByStatus({ statuses: ['issued'] });

  const pendingAwards = pendingResult.success ? pendingResult.data || [] : [];
  const approvedAwards = approvedResult.success ? approvedResult.data || [] : [];
  const issuedAwards = issuedResult.success ? issuedResult.data || [] : [];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link
          href={`/${locale}/dashboard/admin/rewards`}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← {t('backToAdmin', { defaultValue: 'Back to Admin' })}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title', { defaultValue: 'Awards Management' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', {
              defaultValue: 'Review, approve, and issue recognition awards to members',
            })}
          </p>
        </div>
        <CreateAwardDialog />
      </div>

      {/* Awards Tabs */}
      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            {t('tabs.pending', { defaultValue: 'Pending Approval' })} ({pendingAwards.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            {t('tabs.approved', { defaultValue: 'Approved' })} ({approvedAwards.length})
          </TabsTrigger>
          <TabsTrigger value="issued">
            {t('tabs.issued', { defaultValue: 'Issued' })} ({issuedAwards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {t('pending.title', { defaultValue: 'Pending Approvals' })}
              </CardTitle>
              <CardDescription>
                {t('pending.description', {
                  defaultValue: 'Awards awaiting management approval',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AwardsQueue awards={pendingAwards} status="pending_approval" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {t('approved.title', { defaultValue: 'Approved Awards' })}
              </CardTitle>
              <CardDescription>
                {t('approved.description', {
                  defaultValue: 'Awards approved and ready to be issued',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AwardsQueue awards={approvedAwards} status="approved" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {t('issued.title', { defaultValue: 'Issued Awards' })}
              </CardTitle>
              <CardDescription>
                {t('issued.description', {
                  defaultValue: 'Awards that have been issued to members',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AwardsQueue awards={issuedAwards} status="issued" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
