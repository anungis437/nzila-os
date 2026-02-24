/**
 * Operations Dashboard
 * For Platform Lead, COO, CTO - Day-to-day platform operations
 * 
 * @role platform_lead, coo, cto
 * @dashboard_path /dashboard/operations
 */


export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  SystemHealthWidget,
  IncidentQueueWidget,
  SLADashboardWidget,
  ReleaseCalendarWidget,
  CapacityOverviewWidget
} from '@/components/operations/dashboard-widgets';
import { requireMinRole } from '@/lib/api-auth-guard';

export default async function OperationsDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require operations role
  await requireMinRole('platform_lead');
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Operations</h1>
          <p className="text-muted-foreground mt-1">
            Real-time platform health, incidents, and operational metrics
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="sla">SLA & Performance</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Suspense fallback={<CardSkeleton />}>
              <SystemHealthWidget />
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12,345</div>
                  <p className="text-xs text-muted-foreground">
                    +8% from last hour
                  </p>
                </CardContent>
              </Card>
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">API Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">99.97%</div>
                  <p className="text-xs text-muted-foreground">
                    Above 99.95% SLA target
                  </p>
                </CardContent>
              </Card>
            </Suspense>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Suspense fallback={<CardSkeleton />}>
              <IncidentQueueWidget />
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <ReleaseCalendarWidget />
            </Suspense>
          </div>
        </TabsContent>
        
        {/* Incidents Tab */}
        <TabsContent value="incidents" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <IncidentQueueWidget detailed />
          </Suspense>
        </TabsContent>
        
        {/* SLA Tab */}
        <TabsContent value="sla" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <SLADashboardWidget />
          </Suspense>
        </TabsContent>
        
        {/* Releases Tab */}
        <TabsContent value="releases" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <ReleaseCalendarWidget detailed />
          </Suspense>
        </TabsContent>
        
        {/* Capacity Tab */}
        <TabsContent value="capacity" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <CapacityOverviewWidget />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}
