/**
 * Analytics Page
 * Q1 2025 - Advanced Analytics
 * 
 * Main analytics dashboard page
 */


export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Analytics | UnionEyes',
  description: 'Advanced analytics and insights for your organization'
};

async function getOrganizationId() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Get user's organization (simplified - you&apos;d query the database)
  return 'org-id'; // Placeholder
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
