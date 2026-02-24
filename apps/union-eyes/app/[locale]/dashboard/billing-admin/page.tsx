/**
 * Billing Admin Dashboard
 * For Billing Manager & Billing Specialists - Subscription & payment operations
 * 
 * @role billing_manager, billing_specialist
 * @dashboard_path /dashboard/billing-admin
 */


export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireMinRole } from '@/lib/api-auth-guard';
import { DollarSign, CreditCard, TrendingUp, Users, FileText, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch billing subscriptions from API
async function getBillingSubscriptions() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/billing/subscriptions?limit=50`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch billing subscriptions');
      return null;
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error fetching billing subscriptions:', error);
    return null;
  }
}

export default async function BillingAdminDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require billing role
  await requireMinRole('billing_specialist');
  
  // Fetch real data
  const billingData = await getBillingSubscriptions();
  
  // Fallback to placeholder if API fails
  const subscriptions = billingData?.data?.subscriptions || [
    { customer: 'Unifor Local 1', plan: 'Professional', mrr: 1200, status: 'active', renewal: '2026-03-15' },
    { customer: 'CUPE Local 416', plan: 'Enterprise', mrr: 2500, status: 'active', renewal: '2026-02-28' },
    { customer: 'UAW Local 27', plan: 'Professional', mrr: 1200, status: 'past-due', renewal: '2026-02-10' },
  ];
  
  const metrics = billingData?.data?.metrics || {
    total_mrr: 428900,
    active_subscriptions: 342,
    payment_success_rate: 98.5,
    past_due_count: 3,
    mrr_growth: 45000,
    new_subscriptions: 12,
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer subscriptions, invoices, and payments
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Monthly Recurring Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(metrics.total_mrr / 1000).toFixed(1)}K</div>
                <p className="text-xs text-muted-foreground text-green-600">
                  +${(metrics.mrr_growth / 1000).toFixed(0)}K from last month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Subscriptions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.active_subscriptions}</div>
                <p className="text-xs text-muted-foreground">+{metrics.new_subscriptions} this month</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.payment_success_rate}%</div>
                <p className="text-xs text-muted-foreground">Above 98% target</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Past Due
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{metrics.past_due_count}</div>
                <p className="text-xs text-muted-foreground">Require follow-up</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">This Month</span>
                    <span className="text-lg font-bold">${(metrics.total_mrr / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Month</span>
                    <span className="text-lg font-bold text-muted-foreground">${((metrics.total_mrr - metrics.mrr_growth) / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Growth Rate</span>
                    <span className="text-lg font-bold text-green-600">+{((metrics.mrr_growth / (metrics.total_mrr - metrics.mrr_growth)) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoicing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Invoices Sent (30d)</span>
                    <span className="text-lg font-bold">{metrics.active_subscriptions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Paid</span>
                    <span className="text-lg font-bold text-green-600">{metrics.active_subscriptions - metrics.past_due_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Past Due</span>
                    <span className="text-lg font-bold text-orange-600">{metrics.past_due_count}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions found</p>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {subscriptions.map((sub: any) => (
                    <div key={sub.id || sub.customer} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{sub.customer || sub.organization_name}</p>
                        <p className="text-xs text-muted-foreground">{sub.plan} Plan</p>
                        <p className="text-xs text-muted-foreground">Renewal: {sub.renewal || sub.renewal_date}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                          {sub.status}
                        </Badge>
                        <p className="text-sm font-bold">${(sub.mrr || sub.amount).toLocaleString()}/mo</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed revenue analytics and forecasting data
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Invoice list and payment tracking
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
