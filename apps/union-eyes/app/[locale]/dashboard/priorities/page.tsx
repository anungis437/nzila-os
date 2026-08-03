export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrioritiesConsole } from '@/components/priorities/priorities-console';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'prioritiesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function PrioritiesPage() {
  // Auth enforced by dashboard layout; PrioritiesConsole's API calls also gate access.
  return (
    <Suspense fallback={null}>
      <PrioritiesConsole />
    </Suspense>
  );
}
