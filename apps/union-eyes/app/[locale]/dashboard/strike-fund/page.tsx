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
  // Auth is enforced by the dashboard layout (requireUser + getUserRole).
  // Calling requireUser() here redundantly causes transient failures under
  // heavy test load (DB connection pressure) that incorrectly redirect to /login.
  return <StrikeFundConsole />;
}
