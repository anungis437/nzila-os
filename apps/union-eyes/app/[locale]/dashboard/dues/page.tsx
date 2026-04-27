export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import { requireUser } from '@/lib/api-auth-guard';
import DuesPaymentPortal from '@/components/dues/dues-payment-portal';
import { Skeleton } from '@/components/ui/skeleton';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'duesPortalPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function DuesPortalPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'duesPortalPage' });
  const user = await requireUser();
  const userId = user.userId;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subtitle')}
        </p>
      </div>

      <Suspense fallback={<DuesSkeleton />}>
        <DuesPaymentPortal userId={userId} />
      </Suspense>
    </div>
  );
}

function DuesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
