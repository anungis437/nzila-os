export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { TargetsConsole } from '@/components/targets/targets-console';
import { checkModuleEntitlement } from '@/services/platform-economics/entitlement-guard';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'targetsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function TargetsPage() {
  const user = await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  // Premium feature — not available in pilot
  const entitlement = await checkModuleEntitlement(user.organizationId, 'performance_targets');
  if (!entitlement.allowed) {
    redirect('/dashboard');
  }

  return (
    <main className="p-6 md:p-10">
      <TargetsConsole />
    </main>
  );
} 
