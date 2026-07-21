export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { requireUser } from '@/lib/api-auth-guard';
import { Cupe4373DocumentsPage } from '@/components/demo/cupe4373-documents-page';
import { Cupe4373MemberDocumentsPage } from '@/components/demo/cupe4373-member-views';
import { getDashboardExperience } from '@/lib/dashboard/role-experience';
import {
  resolveDemoMemberPersona,
  getMemberDocuments,
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
  const t = await getTranslations({ locale, namespace: 'documentsPage' });
  return {
    title: t('header.title'),
    description: t('header.description'),
  };
}

export default async function DocumentsPage({ params }: PageProps) {
  const { locale } = await params;
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  // Demo build: members see only documents marked public_internal (collective
  // agreement, public minutes, etc.) — not steward-restricted or privileged
  // files. Stewards / officers / admins see the full demo documents page. No
  // operational fallback exists here.
  const { userId } = await auth();
  let demoOrgId: string = DEFAULT_ORGANIZATION_ID;
  try {
    if (userId) demoOrgId = await getOrganizationIdForUser(userId);
  } catch (error) {
    logger.warn('[dashboard:documents] demo getOrganizationIdForUser threw', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  let role: UserRole = UserRole.MEMBER;
  try {
    if (userId) role = await getUserRole(userId, demoOrgId);
  } catch (error) {
    logger.warn('[dashboard:documents] demo getUserRole threw — defaulting to member', {
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
      <Cupe4373MemberDocumentsPage
        persona={persona}
        documents={getMemberDocuments()}
      />
    );
  }
  return <Cupe4373DocumentsPage locale={locale} />;
}
