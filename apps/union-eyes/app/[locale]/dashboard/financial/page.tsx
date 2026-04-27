import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { getTranslations } from 'next-intl/server';
import FinancialOverview from '@/components/financial/FinancialOverview';

/**
 * Financial Management — executive dashboard with KPI cards, arrears tracking,
 * and payment history connected to real dues/remittance data.
 */
export default async function FinancialIndexPage({
  _params,
}: {
  _params: { locale: string };
}) {
  await requireUser();
  const authorized = await hasMinRole('officer');
  if (!authorized) {
    redirect('/login');
  }
  return <FinancialOverview />;
}

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'financialOverviewPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}
