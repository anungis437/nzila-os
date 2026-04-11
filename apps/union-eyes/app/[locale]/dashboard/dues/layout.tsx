import { redirect } from 'next/navigation';
import { requireUser, isCongressOrg } from '@/lib/api-auth-guard';

/**
 * Dues routes layout — blocks congress-type organizations.
 *
 * CLC / congress orgs should not see individual union dues data;
 * they have their own dashboard at /dashboard/clc with per-capita
 * remittance visibility only.
 */
export default async function DuesLayout({
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
