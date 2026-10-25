export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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
 * The layout only checks that a session exists. Document authorization is enforced
 * by the repository and download routes, not by this page.
 */
export default async function DocumentsPage() {
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
      <DocumentsConsole />
    </div>
  );
}
