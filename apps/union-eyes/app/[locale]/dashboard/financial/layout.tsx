import { redirect } from 'next/navigation';
import { requireUser, isCongressOrg } from '@/lib/api-auth-guard';

/**
 * Financial routes layout — blocks congress-type organizations.
 *
 * CLC / congress orgs should not see individual union financial data;
 * they have their own dashboard at /dashboard/clc.
 */
export default async function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (await isCongressOrg(user.organizationId)) {
    redirect('/dashboard/clc');
  }
  return <>{children}</>;
}
