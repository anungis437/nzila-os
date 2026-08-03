import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import StrikeFundConsole from '@/components/strike-fund/strike-fund-console';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'strikeFundPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function StrikeFundDashboardPage() {
  // Auth + role are enforced by the parent segment layout at
  // app/[locale]/dashboard/strike-fund/layout.tsx (requireUser + hasMinRole('secretary_treasurer'))
  // and the outer dashboard layout (requireUser). No page-level guard needed.
  return <StrikeFundConsole />;
}
