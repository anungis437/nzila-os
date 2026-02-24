/**
 * Customer Success Dashboard
 * For Customer Success Director - User success, retention, and growth
 * 
 * @role customer_success_director
 * @dashboard_path /dashboard/customer-success
 */


export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CustomerHealthScoresWidget,
  OnboardingProgressWidget,
  ChurnRiskWidget,
  AdoptionMetricsWidget,
  NPSWidget,
  CustomerFeedbackWidget
} from '@/components/customer-success/dashboard-widgets';
import { requireMinRole } from '@/lib/api-auth-guard';

export default async function CustomerSuccessDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require customer success role
  await requireMinRole('customer_success_director');
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Success</h1>
          <p className="text-muted-foreground mt-1">
            Monitor customer health, onboarding, and retention metrics
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Customer Health</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="churn">Churn Risk</TabsTrigger>
          <TabsTrigger value="adoption">Adoption</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Suspense fallback={<CardSkeleton />}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">342</div>
                  <p className="text-xs text-muted-foreground">
                    +12 this month
                  </p>
                </CardContent>
              </Card>
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2.3%</div>
                  <p className="text-xs text-muted-foreground text-green-600">
                    -0.5% from last month
                  </p>
                </CardContent>
              </Card>
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Net Promoter Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">72</div>
                  <p className="text-xs text-muted-foreground">
                    Excellent (World-class)
                  </p>
                </CardContent>
              </Card>
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">At-Risk Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">8</div>
                  <p className="text-xs text-muted-foreground">
                    Require attention
                  </p>
                </CardContent>
              </Card>
            </Suspense>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Suspense fallback={<CardSkeleton />}>
              <CustomerHealthScoresWidget />
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <AdoptionMetricsWidget />
            </Suspense>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Suspense fallback={<CardSkeleton />}>
              <OnboardingProgressWidget />
            </Suspense>
            
            <Suspense fallback={<CardSkeleton />}>
              <ChurnRiskWidget />
            </Suspense>
          </div>
        </TabsContent>
        
        {/* Customer Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <CustomerHealthScoresWidget detailed />
          </Suspense>
        </TabsContent>
        
        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <OnboardingProgressWidget detailed />
          </Suspense>
        </TabsContent>
        
        {/* Churn Risk Tab */}
        <TabsContent value="churn" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <ChurnRiskWidget detailed />
          </Suspense>
        </TabsContent>
        
        {/* Adoption Tab */}
        <TabsContent value="adoption" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <AdoptionMetricsWidget detailed />
          </Suspense>
        </TabsContent>
        
        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <Suspense fallback={<CardSkeleton />}>
            <CustomerFeedbackWidget />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <NPSWidget detailed />
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
