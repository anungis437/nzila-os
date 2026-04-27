export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import BudgetManager from '@/components/financial/BudgetManager';
import { requireUser, hasMinRole, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'financialBudgetsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function BudgetsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'financialBudgetsPage' });
  const user = await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  // Check minimum role level (85 = Financial Officer)
  const userLevel = Math.max(0, ...user.roles.map(r => ROLE_HIERARCHY[r as keyof typeof ROLE_HIERARCHY] ?? 0));
  if (userLevel < 85) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('accessDeniedTitle')}</h1>
          <p className="text-muted-foreground">
            {t('accessDeniedBody')}
          </p>
        </div>
      </div>
    );
  }

  const organizationId = user.organizationId;

  return (
    <div className="container mx-auto py-10">
      <Suspense fallback={<div className="text-center py-10">{t('loading')}</div>}>
        <BudgetManager organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
