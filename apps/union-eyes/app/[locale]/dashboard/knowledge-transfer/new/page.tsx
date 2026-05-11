import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ExitInterviewCreateForm } from '@/components/knowledge-transfer/exit-interview-create-form';

export const dynamic = 'force-dynamic';

export default async function NewExitInterviewPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <ExitInterviewCreateForm />;
}
