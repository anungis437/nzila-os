import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth/rbac-server';
import { getRoleLandingPath } from '@/lib/dashboard/role-experience';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { logger } from '@/lib/logger';

type DashboardRootPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DashboardRootPage({ params }: DashboardRootPageProps) {
  const { locale } = await params;
  const { userId } = await auth();

  if (!userId) {
    logger.error('[dashboard:root] auth() returned null userId — redirecting to /login', {
      stage: 'auth',
      locale,
    });
    redirect('/login');
  }

  let organizationId: string;
  try {
    organizationId = await getOrganizationIdForUser(userId);
  } catch (error) {
    logger.error('[dashboard:root] getOrganizationIdForUser threw', {
      stage: 'organization',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  let userRole: Awaited<ReturnType<typeof getUserRole>>;
  try {
    userRole = await getUserRole(userId, organizationId);
  } catch (error) {
    logger.error('[dashboard:root] getUserRole threw', {
      stage: 'role',
      userId,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const landingPath = getRoleLandingPath(userRole);

  logger.info('[dashboard:root] resolved role landing — issuing redirect', {
    stage: 'redirect',
    userId,
    organizationId,
    userRole,
    landingPath,
    locale,
  });

  redirect(`/${locale}${landingPath}`);
}
