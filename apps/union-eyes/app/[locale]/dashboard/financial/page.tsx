import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import FinancialOverview from '@/components/financial/FinancialOverview';

/**
 * Financial Management — executive dashboard with KPI cards, arrears tracking,
 * and payment history connected to real dues/remittance data.
 */
export default async function FinancialIndexPage({
  _params,
}: {
  _params: { locale: string };
}) {
  await requireUser();
  const authorized = await hasMinRole('officer');
  if (!authorized) {
    redirect('/login');
  }
  return <FinancialOverview />;
}
