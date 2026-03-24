export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import BudgetDetailClient from './BudgetDetailClient';

export default async function BudgetDetailPage() {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  return <BudgetDetailClient />;
}
