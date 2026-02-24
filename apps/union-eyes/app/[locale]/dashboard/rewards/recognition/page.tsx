export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { getTranslations } from 'next-intl/server';
import { PeerNominationForm } from '@/components/rewards/peer-nomination-form';
import { listAwardTypes } from '@/actions/rewards-actions';
import { listRecognitionPrograms } from '@/actions/rewards-actions';
import { eq } from 'drizzle-orm';
import { organizationMembers } from '@/db/schema';

export const metadata: Metadata = {
  title: 'Recognize a Peer | Recognition & Rewards',
  description: 'Nominate a colleague for recognition',
};

async function getOrganizationMembers(orgId: string) {
  const members = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, orgId),
  });

  return members.map((member) => ({
    userId: member.userId,
    name: member.name || 'Unknown',
    email: member.email || '',
    avatar: undefined,
    role: member.status,
  }));
}

export default async function PeerRecognitionPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards.peer');

  // Fetch recognition programs
  const programsResult = await listRecognitionPrograms();
  
  if (!programsResult.success || !programsResult.data || !programsResult.data.length) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeProgram = programsResult.data?.find((p: any) => p.status === 'active');
  
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

  // Fetch award types for peer recognition
  const awardTypesResult = await listAwardTypes(activeProgram.id);
  
  if (!awardTypesResult.success || !awardTypesResult.data || !awardTypesResult.data.length) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">{t('noAwardTypes')}</h2>
          <p className="text-muted-foreground">{t('noAwardTypesDescription')}</p>
        </div>
      </div>
    );
  }

  // Fetch organization members
  const members = await getOrganizationMembers(orgId);

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('pageDescription')}</p>
      </div>

      <PeerNominationForm
        awardTypes={awardTypesResult.data || []}
        organizationMembers={members}
        currentUserId={userId}
      />
    </div>
  );
}
