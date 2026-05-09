import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth/rbac-server';
import { getRoleLandingPath } from '@/lib/dashboard/role-experience';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

type DashboardRootPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DashboardRootPage({ params }: DashboardRootPageProps) {
  const { locale } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const organizationId = await getOrganizationIdForUser(userId);
  const userRole = await getUserRole(userId, organizationId);
  const landingPath = getRoleLandingPath(userRole);

  redirect(`/${locale}${landingPath}`);
}
