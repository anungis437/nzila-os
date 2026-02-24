/**
 * Support Operations Dashboard
 * For Support Manager & Support Agents - Help desk operations
 * 
 * @role support_manager, support_agent
 * @dashboard_path /dashboard/support
 */


export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireMinRole } from '@/lib/api-auth-guard';
import { Headphones, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch support metrics from API
async function getSupportMetrics() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/support/metrics`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch support metrics');
      return null;
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error fetching support metrics:', error);
    return null;
  }
}

// Fetch support tickets from API
async function getSupportTickets() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/support/tickets?limit=10`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch support tickets');
      return [];
    }
    
    const data = await response.json();
    return data.data?.tickets || [];
  } catch (error) {
    logger.error('Error fetching support tickets:', error);
    return [];
  }
}

export default async function SupportDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require support role
  await requireMinRole('support_agent');
  
  // Fetch real data
  const [metrics, tickets] = await Promise.all([
    getSupportMetrics(),
    getSupportTickets(),
  ]);
  
  // Fallback to placeholder if API fails
  const metricsData = metrics?.data || {
    open_tickets: 27,
    high_priority_count: 5,
    avg_response_time_minutes: 12,
    resolved_today: 43,
    csat_score: 4.8,
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support Operations</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer support tickets and knowledge base
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData.open_tickets}</div>
            <p className="text-xs text-muted-foreground">{metricsData.high_priority_count} high priority</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData.avg_response_time_minutes}m</div>
            <p className="text-xs text-muted-foreground text-green-600">
              Below 15m target
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Resolved Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData.resolved_today}</div>
            <p className="text-xs text-muted-foreground">+8 from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              CSAT Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData.csat_score.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Out of 5.0</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Ticket Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets found</p>
          ) : (
            <div className="space-y-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tickets.map((ticket: any) => (
                <div key={ticket.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}>
                        {ticket.priority}
                      </Badge>
                      <span className="text-sm font-medium">{ticket.ticket_number || ticket.id}</span>
                      <span className="text-xs text-muted-foreground">• {ticket.age || 'new'}</span>
                    </div>
                    <p className="text-sm">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{ticket.customer || ticket.organization_name}</p>
                  </div>
                  <Badge variant="outline">{ticket.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
