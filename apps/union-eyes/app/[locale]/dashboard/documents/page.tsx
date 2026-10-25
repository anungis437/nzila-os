export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser, getUserRole } from '@/lib/api-auth-guard';
import { getDashboardExperience } from '@/lib/dashboard/role-experience';
import { MemberDocuments } from '@/components/documents/member-documents';
import { DocumentsConsole } from '@/components/documents/documents-console';

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

/**
 * /dashboard/documents — canonical document library.
 * The layout only checks that a session exists. Document authorization is enforced by the repository and download
 * routes, not by this page. Members get their own surface (their documents and what the union shares with all
 * members); the library console is the staff surface.
 */
export default async function DocumentsPage() {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);

  // Members get their own documents and what the union shares with all members. The staff document
  // library is a separate surface and is not exposed to them.
  if (getDashboardExperience(role) === 'member') {
    return <MemberDocuments />;
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
      <DocumentsConsole />
    </div>
  );
}
