import { redirect } from 'next/navigation';
import { requireUser, isCongressOrg } from '@/lib/api-auth-guard';

/**
 * Admin dues routes layout — blocks congress-type organizations.
 *
 * CLC / congress orgs should not have admin access to union-level
 * dues management; they have their own dashboard at /dashboard/clc.
 */
export default async function AdminDuesLayout({
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
