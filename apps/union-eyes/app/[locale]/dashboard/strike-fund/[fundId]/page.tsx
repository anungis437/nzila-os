import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import StrikeFundDetailConsole from '@/components/strike-fund/strike-fund-detail-console';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; fundId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'strikeFundDetailPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function StrikeFundDetailsPage(props: {
  params: Promise<{ locale: string; fundId: string }>;
}) {
  await requireUser();
  await hasMinRole('member');

  const { fundId } = await props.params;

  return <StrikeFundDetailConsole fundId={fundId} />;
}
