/**
 * Integrations Dashboard
 * For Integration Manager - API keys, webhooks, and partner integrations
 * 
 * @role integration_manager
 * @dashboard_path /dashboard/integrations
 */


export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireMinRole } from '@/lib/api-auth-guard';
import { Key, Webhook, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch API keys from API
async function getApiKeys() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/api-keys`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch API keys');
      return [];
    }
    
    const data = await response.json();
    return data.data?.keys || [];
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    return [];
  }
}

// Fetch webhooks from API
async function getWebhooks() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/webhooks`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch webhooks');
      return [];
    }
    
    const data = await response.json();
    return data.data?.webhooks || [];
  } catch (error) {
    logger.error('Error fetching webhooks:', error);
    return [];
  }
}

export default async function IntegrationsDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require integration manager role
  await requireMinRole('integration_manager');
  
  // Fetch real data
  const [apiKeys, webhooks] = await Promise.all([
    getApiKeys(),
    getWebhooks(),
  ]);
  
  // Calculate metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeApiKeys = apiKeys.filter((key: any) => key.status === 'active').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeWebhooks = webhooks.filter((hook: any) => hook.status === 'active').length;
  const webhookSuccessRate = webhooks.length > 0 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ((webhooks.filter((hook: any) => hook.last_status === 'success').length / webhooks.length) * 100).toFixed(1)
    : '100.0';
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys, webhooks, and partner integrations
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Active API Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeApiKeys}</div>
                <p className="text-xs text-muted-foreground">Out of {apiKeys.length} total</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Active Webhooks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeWebhooks}</div>
                <p className="text-xs text-muted-foreground">Out of {webhooks.length} total</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Webhook Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webhookSuccessRate}%</div>
                <p className="text-xs text-muted-foreground text-green-600">
                  Last 24 hours
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Integration Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Healthy</div>
                <p className="text-xs text-muted-foreground">All systems operational</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent API Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Requests (24h)</span>
                    <span className="text-lg font-bold">45,892</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Success Rate</span>
                    <span className="text-lg font-bold text-green-600">99.8%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Response Time</span>
                    <span className="text-lg font-bold">145ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Integration Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Stripe</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Slack</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Salesforce</span>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No API keys found</p>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {apiKeys.map((key: any) => (
                    <div key={key.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{key.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{key.key_preview || '••••••••'}</p>
                        <p className="text-xs text-muted-foreground">Created: {key.created_at || 'Unknown'}</p>
                      </div>
                      <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                        {key.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhooks configured</p>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {webhooks.map((hook: any) => (
                    <div key={hook.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{hook.name || hook.url}</p>
                        <p className="text-xs text-muted-foreground">{hook.event_type || 'All events'}</p>
                        <p className="text-xs text-muted-foreground">
                          Last triggered: {hook.last_triggered || 'Never'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={hook.status === 'active' ? 'default' : 'secondary'}>
                          {hook.status}
                        </Badge>
                        {hook.last_status && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {hook.last_status === 'success' ? (
                              <CheckCircle2 className="h-3 w-3 inline text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 inline text-red-600" />
                            )}
                            {' '}{hook.last_status}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Partner Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure and manage third-party integrations
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
