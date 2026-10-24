import { redirect } from 'next/navigation';
import { requireUser, hasMinRole, isCongressOrg } from '@/lib/api-auth-guard';

/**
 * Finance routes layout — blocks congress-type organizations.
 *
 * CLC / congress orgs should not see individual union financial data;
 * they have their own dashboard at /dashboard/clc.
 *
 * Financial visibility is not inherited by a general officer (UE-OFFICER-
 * EXECUTIVE-CANONICAL-2.1 §VII); the floor matches the /api/finance handlers.
 */
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (await isCongressOrg(user.organizationId)) {
    redirect('/dashboard/clc');
  }
  if (!(await hasMinRole('secretary_treasurer'))) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
