import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import TrusteePortalPage from '@/components/pension/trustee-portal-page';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pensionTrusteePage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PensionTrusteePage() {
  await requireUser();
  await hasMinRole('member');

  return <TrusteePortalPage />;
}
