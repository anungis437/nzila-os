export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

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
  const t = await getTranslations('documentsPage');
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('header.title')}</h1>
      <p className="text-gray-600">{t('header.description')}</p>
    </div>
  );
}
