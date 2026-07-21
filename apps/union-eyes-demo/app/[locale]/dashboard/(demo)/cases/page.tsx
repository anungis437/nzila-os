export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { CasesConsole } from '@/components/cases/cases-console';
import { Cupe4373CasesConsole } from '@/components/demo/cupe4373-cases-console';
import { Cupe4373MemberCasesConsole } from '@/components/demo/cupe4373-member-views';
import {
  isCupe4373DemoRuntime,
  getDashboardExperience,
} from '@/lib/dashboard/role-experience';
import { getDemoCasesFromDb } from '@/lib/demo/server/cupe4373-cases-repo';
import {
  resolveDemoMemberPersona,
  getMemberCases,
} from '@/lib/demo/cupe4373-member-view';
import { getUserRole } from '@/lib/auth/rbac-server';
import { UserRole } from '@/lib/auth/roles';
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from '@/lib/organization-utils';
import { logger } from '@/lib/logger';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'casesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CasesPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  if (isCupe4373DemoRuntime()) {
    // Members get their own files only (read-only view). Stewards / officers /
    // admins get the full demo cases console.
    const { userId } = await auth();
    let demoOrgId: string = DEFAULT_ORGANIZATION_ID;
    try {
      if (userId) demoOrgId = await getOrganizationIdForUser(userId);
    } catch (error) {
      logger.warn('[dashboard:cases] demo getOrganizationIdForUser threw', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    let role: UserRole = UserRole.MEMBER;
    try {
      if (userId) role = await getUserRole(userId, demoOrgId);
    } catch (error) {
      logger.warn('[dashboard:cases] demo getUserRole threw — defaulting to member', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (getDashboardExperience(role) === 'member') {
      const user = await currentUser();
      const persona = resolveDemoMemberPersona({
        fullName: user?.fullName ?? null,
        firstName: user?.firstName ?? null,
        email: user?.emailAddresses?.[0]?.emailAddress ?? null,
      });
      return (
        <Cupe4373MemberCasesConsole persona={persona} cases={getMemberCases(persona)} />
      );
    }

    const cases = await getDemoCasesFromDb();
    const usingDb =
      process.env.UE_DEMO_DATA_SOURCE === 'db' ||
      (process.env.DATABASE_URL?.includes('demo-db') ?? false);
    return <Cupe4373CasesConsole cases={cases} dataSource={usingDb ? 'db' : 'static'} />;
  }

  const hasAccess = await hasMinRole('steward');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <CasesConsole />;
}
