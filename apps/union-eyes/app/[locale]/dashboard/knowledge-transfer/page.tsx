import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { KnowledgeTransferConsole } from '@/components/knowledge-transfer/knowledge-transfer-console';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Knowledge Transfer',
  description: 'Institutional memory capture and retrieval for union continuity.',
};

export default async function KnowledgeTransferPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <KnowledgeTransferConsole />;
}
