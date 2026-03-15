import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';

/**
 * Financial Management index — redirects to the Expenses sub-page which is the
 * most common entry-point for leadership users.
 */
export default async function FinancialIndexPage({
  _params,
}: {
  _params: { locale: string };
}) {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }
  redirect('/dashboard/financial/expenses');
}
