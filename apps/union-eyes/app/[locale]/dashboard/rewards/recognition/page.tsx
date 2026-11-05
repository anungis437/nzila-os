export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireOrganizationScope } from '@/lib/page-data/organization-scope';
import { getTranslations } from 'next-intl/server';
import { PeerNominationForm } from '@/components/rewards/peer-nomination-form';
import { listAwardTypes } from '@/actions/rewards-actions';
import { listRecognitionPrograms } from '@/actions/rewards-actions';
import { listRecognitionCandidates } from '@/lib/rewards/page-reads';

export const metadata: Metadata = {
  title: 'Recognize a Peer | Recognition & Rewards',
  description: 'Nominate a colleague for recognition',
};

export default async function PeerRecognitionPage() {
  const { userId, organizationId } = await requireOrganizationScope();

  const t = await getTranslations('rewards.peer');

  // Fetch recognition programs. A failed read is an error, not "no programs".
  const programsResult = await listRecognitionPrograms();
  if (!programsResult.success) {
    throw new Error(('error' in programsResult && programsResult.error) || 'The recognition programs could not be loaded');
  }
  
  if (!programsResult.data || !programsResult.data.length) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">{t('noPrograms')}</h2>
          <p className="text-muted-foreground">{t('noProgramsDescription')}</p>
        </div>
      </div>
    );
  }

  // Get the first active program (or you can let user select)
  const activeProgram = programsResult.data.find((p) => p.status === 'active');
  
  if (!activeProgram) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">{t('noActivePrograms')}</h2>
          <p className="text-muted-foreground">{t('noActiveProgramsDescription')}</p>
        </div>
      </div>
    );
  }

  // Fetch award types for peer recognition: a member nominates for the peer ones only (the server refuses any other).
  const awardTypesResult = await listAwardTypes(activeProgram.id);
  if (!awardTypesResult.success) {
    throw new Error(('error' in awardTypesResult && awardTypesResult.error) || 'The award types could not be loaded');
  }

  const peerAwardTypes = (awardTypesResult.data ?? [])
    .filter((awardType) => awardType.kind === 'peer')
    .map((awardType) => ({ id: awardType.id, name: awardType.name, defaultCreditAmount: awardType.defaultCreditAmount }));

  if (peerAwardTypes.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">{t('noPeerAwards')}</h2>
          <p className="text-muted-foreground">{t('noPeerAwardsDescription')}</p>
        </div>
      </div>
    );
  }

  // The colleagues a nomination can name, by name only: a member does not get everybody's e-mail address from a picker.
  const candidates = await listRecognitionCandidates(organizationId);

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('pageDescription')}</p>
      </div>

      <PeerNominationForm
        awardTypes={peerAwardTypes}
        candidates={candidates}
        currentUserId={userId}
      />
    </div>
  );
}
