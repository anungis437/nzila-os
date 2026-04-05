/**
 * Analytics Page
 * Q1 2025 - Advanced Analytics
 * 
 * Main analytics dashboard page
 */


export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { RefreshCw } from 'lucide-react';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

export const metadata = {
  title: 'Analytics | UnionEyes',
  description: 'Advanced analytics and insights for your organization'
};

async function getOrganizationId() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return getOrganizationIdForUser(userId);
}

export default async function AnalyticsPage() {
  const organizationId = await getOrganizationId();

  return (
    <div className="container mx-auto py-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        }
      >
        <AnalyticsDashboard organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
