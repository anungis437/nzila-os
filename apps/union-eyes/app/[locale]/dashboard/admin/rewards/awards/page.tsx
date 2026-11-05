export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { hasMinRole } from '@/lib/api-auth-guard';
import { requireOrganizationScope } from '@/lib/page-data/organization-scope';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { listAwardsByStatus, listAwardTypes } from '@/actions/rewards-actions';
import { loadActiveProgram, listRecognitionCandidates, loadMemberNames } from '@/lib/rewards/page-reads';
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
  const { organizationId } = await requireOrganizationScope();
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

  // A failed read is an error to show, not three empty queues.
  const failed = [pendingResult, approvedResult, issuedResult].find((result) => !result.success);
  if (failed) {
    const reason = 'error' in failed && typeof failed.error === 'string' ? failed.error : undefined;
    return (
      <div className="container mx-auto py-8 space-y-4">
        <Link
          href={`/${locale}/dashboard/admin/rewards`}
          className="text-sm text-muted-foreground hover:text-foreground inline-block"
        >
          ← {t('backToAdmin', { defaultValue: 'Back to Admin' })}
        </Link>
        <div role="alert" className="rounded-md border border-destructive/50 p-4">
          <h1 className="text-xl font-semibold">
            {t('loadFailed.title', { defaultValue: 'The awards could not be loaded' })}
          </h1>
          {reason && <p className="text-sm text-muted-foreground mt-1">{reason}</p>}
        </div>
      </div>
    );
  }

  const pendingAwards = (pendingResult.success && pendingResult.data) || [];
  const approvedAwards = (approvedResult.success && approvedResult.data) || [];
  const issuedAwards = (issuedResult.success && issuedResult.data) || [];

  // The administrator creates awards in the active program, for current members (named, with e-mail: this page is administrator-only),
  // and reads the queues by name: a person is shown by name, never only by an opaque id.
  const program = await loadActiveProgram(organizationId);
  const awardTypesResult = program ? await listAwardTypes(program.id) : null;
  if (awardTypesResult && !awardTypesResult.success) {
    throw new Error(('error' in awardTypesResult && awardTypesResult.error) || 'The award types could not be loaded');
  }
  const awardTypes = (awardTypesResult && 'data' in awardTypesResult && awardTypesResult.data ? awardTypesResult.data : []).map((awardType) => ({
    id: awardType.id,
    name: awardType.name,
    defaultCreditAmount: awardType.defaultCreditAmount,
  }));
  const members = await listRecognitionCandidates(organizationId, { includeEmail: true });
  const names = await loadMemberNames(
    organizationId,
    [...pendingAwards, ...approvedAwards, ...issuedAwards].flatMap((award) => [award.recipientUserId, award.issuerUserId ?? '']).filter(Boolean),
  );

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
        <CreateAwardDialog programId={program?.id ?? null} awardTypes={awardTypes} members={members} />
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
              <AwardsQueue awards={pendingAwards} status="pending_approval" names={names} />
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
              <AwardsQueue awards={approvedAwards} status="approved" names={names} />
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
              <AwardsQueue awards={issuedAwards} status="issued" names={names} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
