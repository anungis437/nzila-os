import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { GovernanceCultureWorkspace } from '@/components/knowledge-transfer/governance-culture-workspace';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Governance Culture Intelligence',
};

export default async function GovernanceCulturePage() {
  const user = await requireUser();
  if (!user) redirect('/sign-in');
  return <GovernanceCultureWorkspace />;
}
