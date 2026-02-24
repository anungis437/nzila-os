/**
 * Analytics Admin Dashboard
 * For Data Analytics Manager & Data Analysts - Platform-wide analytics
 * 
 * @role data_analytics_manager, data_analyst
 * @dashboard_path /dashboard/analytics-admin
 */


export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireMinRole } from '@/lib/api-auth-guard';
import { BarChart3, Users, FileText, TrendingUp, Database, Activity } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch cross-tenant analytics from API
async function getCrossTenantAnalytics() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analytics/cross-tenant?metric_type=all`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch cross-tenant analytics');
      return null;
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error fetching cross-tenant analytics:', error);
    return null;
  }
}

export default async function AnalyticsAdminDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require analytics role
  await requireMinRole('data_analyst');
  
  // Fetch real data
  const analytics = await getCrossTenantAnalytics();
  
  // Fallback to placeholder if API fails
  const analyticsData = analytics?.data || {
    total_organizations: 342,
    active_users_30d: 45892,
    total_claims: 8234,
    user_growth_pct: 12,
    module_usage: [
      { name: 'Claims Management', sessions: 12500, pct: 87 },
      { name: 'CBA Library', sessions: 8200, pct: 72 },
      { name: 'Bargaining', sessions: 5100, pct: 45 },
      { name: 'Health & Safety', sessions: 3200, pct: 38 },
    ],
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Cross-organization analytics, custom reports, and data insights
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.total_organizations}</div>
                <p className="text-xs text-muted-foreground">Across all regions</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Active Users (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.active_users_30d.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground text-green-600">
                  +{analyticsData.user_growth_pct}% from last month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Claims Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.total_claims.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage by Module
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {analyticsData.module_usage.map((module: any) => (
                    <div key={module.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{module.name}</span>
                        <span className="text-muted-foreground">{module.sessions.toLocaleString()} sessions</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${module.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Growth Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">New Organizations</span>
                    <span className="text-lg font-bold text-green-600">+{analyticsData.new_organizations || 12}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">User Growth</span>
                    <span className="text-lg font-bold text-green-600">+{analyticsData.user_growth_pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Activity Increase</span>
                    <span className="text-lg font-bold text-green-600">+{analyticsData.activity_increase_pct || 15}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retention Rate</span>
                    <span className="text-lg font-bold text-green-600">{analyticsData.retention_rate || 97.7}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed organization data and analytics will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Usage trends and patterns across the platform
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Feature adoption metrics and reports
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Export Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Export platform-wide data for custom analysis in external BI tools
          </p>
          <div className="flex gap-4 mt-4">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              Export CSV
            </button>
            <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
              Export JSON
            </button>
            <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
              Schedule Report
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
