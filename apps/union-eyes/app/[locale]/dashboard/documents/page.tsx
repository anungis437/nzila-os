export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser, getUserRole } from '@/lib/api-auth-guard';
import { getDashboardExperience } from '@/lib/dashboard/role-experience';
import { MemberDocuments } from '@/components/documents/member-documents';

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
 * /dashboard/documents — document library root.
 *
 * Access is gated by the documents layout (requires steward role or above).
 */
export default async function DocumentsPage() {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);

  // Members get their own documents and what the union shares with all members. The staff document
  // library is a separate surface and is not exposed to them.
  if (getDashboardExperience(role) === 'member') {
    return <MemberDocuments />;
  }

  const t = await getTranslations('documentsPage');
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('header.title')}</h1>
      <p className="text-gray-600">{t('header.description')}</p>
    </div>
  );
}
