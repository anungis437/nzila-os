import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { InstitutionalOperatingIntelligenceWorkspace } from '@/components/knowledge-transfer/institutional-operating-intelligence/operating-intelligence-workspace';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Institutional Operating Intelligence',
};

export default async function InstitutionalOperatingIntelligencePage() {
  const user = await requireUser();
  if (!user) redirect('/sign-in');
  return <InstitutionalOperatingIntelligenceWorkspace />;
}
