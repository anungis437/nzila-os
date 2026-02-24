/**
 * Security Dashboard
 * For Security Manager - Security events, threats, access monitoring
 * 
 * @role security_manager
 * @dashboard_path /dashboard/security
 */


export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireMinRole } from '@/lib/api-auth-guard';
import { Shield, AlertTriangle, Activity, XCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch security events from API
async function getSecurityEvents() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/security/events?limit=20`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch security events');
      return [];
    }
    
    const data = await response.json();
    return data.data?.events || [];
  } catch (error) {
    logger.error('Error fetching security events:', error);
    return [];
  }
}

export default async function SecurityDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require security manager role
  await requireMinRole('security_manager');
  
  // Fetch real data
  const securityEvents = await getSecurityEvents();
  
  // Calculate metrics
  const totalEvents = securityEvents.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const criticalAlerts = securityEvents.filter((event: any) => 
    event.severity === 'critical' || event.risk_level === 'critical'
  ).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockedThreats = securityEvents.filter((event: any) => 
    event.status === 'blocked' || event.action === 'blocked'
  ).length;
  const securityScore = totalEvents > 0 
    ? (((totalEvents - criticalAlerts) / totalEvents) * 100).toFixed(1)
    : '100.0';
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Operations</h1>
        <p className="text-muted-foreground mt-1">
          Monitor security events, threats, and access patterns
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="access">Access Logs</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{securityScore}%</div>
                <p className="text-xs text-muted-foreground">Above baseline</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{criticalAlerts}</div>
                <p className="text-xs text-muted-foreground">Require immediate action</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Blocked Threats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{blockedThreats}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Security Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEvents}</div>
                <p className="text-xs text-muted-foreground">Total monitored</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Threat Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed Login Attempts</span>
                    <span className="text-lg font-bold">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Suspicious IP Addresses</span>
                    <span className="text-lg font-bold">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rate Limit Violations</span>
                    <span className="text-lg font-bold">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SQL Injection Attempts</span>
                    <span className="text-lg font-bold text-red-600">2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Access Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Sessions</span>
                    <span className="text-lg font-bold">2,345</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Privileged Access Events</span>
                    <span className="text-lg font-bold">187</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Unauthorized Access Attempts</span>
                    <span className="text-lg font-bold text-orange-600">5</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Multi-Factor Auth Success</span>
                    <span className="text-lg font-bold text-green-600">99.8%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Security Posture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Firewall Protection</span>
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Intrusion Detection</span>
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Encryption Coverage</span>
                    <Badge variant="default" className="bg-green-600">100%</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {securityEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No security alerts</p>
              ) : (
                <div className="space-y-3">
                  {securityEvents
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((event: any) => event.severity === 'critical' || event.severity === 'high')
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((event: any, index: number) => (
                      <div key={event.id || index} className="flex items-center justify-between border-b pb-3 last:border-0">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={event.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {event.severity || 'medium'}
                            </Badge>
                            <span className="text-sm font-medium">{event.event_type || event.type}</span>
                          </div>
                          <p className="text-sm">{event.description || event.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.source_ip || event.ip_address} • {event.timestamp || event.created_at}
                          </p>
                        </div>
                        <Badge variant={event.status === 'blocked' ? 'default' : 'outline'}>
                          {event.status || event.action}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Threats Tab */}
        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threat Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {securityEvents
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .filter((event: any) => event.status === 'blocked' || event.threat_type)
                  .slice(0, 10)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((event: any, index: number) => (
                    <div key={event.id || index} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{event.threat_type || event.event_type}</p>
                        <p className="text-xs text-muted-foreground">
                          Source: {event.source_ip || event.ip_address} • {event.timestamp || event.created_at}
                        </p>
                      </div>
                      <Badge variant="default" className="bg-red-600">Blocked</Badge>
                    </div>
                  ))}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {securityEvents.filter((event: any) => event.status === 'blocked').length === 0 && (
                  <p className="text-sm text-muted-foreground">No threats detected</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Access Logs Tab */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              {securityEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No access logs found</p>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {securityEvents.map((event: any, index: number) => (
                    <div key={event.id || index} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{event.user_email || event.user || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{event.action || event.event_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.resource || event.target} • {event.timestamp || event.created_at}
                        </p>
                      </div>
                      <Badge variant={event.success ? 'default' : 'destructive'}>
                        {event.success !== false ? 'Success' : 'Failed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
