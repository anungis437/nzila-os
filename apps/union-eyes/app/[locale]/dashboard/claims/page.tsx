export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/api-auth-guard';
import { ClaimsConsole } from '@/components/claims/claims-console';
import { getDashboardExperience } from '@/lib/dashboard/role-experience';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'claimsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ClaimsPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/login');
  }

  // Claims are accessible to all authenticated users (members see own, stewards+ see org-wide)
  const view = user.roles.some((role) => getDashboardExperience(role) !== 'member') ? 'staff' : 'member';
  return <ClaimsConsole view={view} />;
}
