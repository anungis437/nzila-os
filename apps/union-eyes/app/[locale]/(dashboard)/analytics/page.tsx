/**
 * Analytics Page
 * Q1 2025 - Advanced Analytics
 * 
 * Main analytics dashboard page
 */


export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Metadata } from 'next';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { RefreshCw } from 'lucide-react';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboardAnalyticsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

async function getOrganizationId() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return getOrganizationIdForUser(userId);
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboardAnalyticsPage' });
  const organizationId = await getOrganizationId();

  return (
    <div className="container mx-auto py-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          </div>
        }
      >
        <AnalyticsDashboard organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
