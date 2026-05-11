import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ContinuityIntelligenceCockpit } from '@/components/knowledge-transfer/continuity-intelligence-cockpit';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Continuity Intelligence',
  description:
    'Executive organizational continuity oversight: fragility analysis, expertise concentration risks, succession readiness, and governance intelligence.',
};

export default async function ContinuityIntelligencePage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <ContinuityIntelligenceCockpit />;
}
