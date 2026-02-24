/**
 * Operations Dashboard Widgets
 * Placeholder components for platform operations monitoring
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
 
 
 
 
 
import { Activity, AlertCircle, CheckCircle2, Clock, Server, TrendingUp } from 'lucide-react';

interface WidgetProps {
  detailed?: boolean;
}

export function SystemHealthWidget({ detailed: _detailed = false }: WidgetProps) {
  const services = [
    { name: 'API Gateway', status: 'healthy', uptime: '99.99%' },
    { name: 'Database', status: 'healthy', uptime: '100%' },
    { name: 'Cache', status: 'degraded', uptime: '99.87%' },
    { name: 'CDN', status: 'healthy', uptime: '99.95%' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          System Health
        </CardTitle>
        <CardDescription>Real-time service status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {service.status === 'healthy' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <span className="text-sm">{service.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{service.uptime}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function IncidentQueueWidget({ detailed: _detailed = false }: WidgetProps) {
  const incidents = [
    { id: 'INC-001', title: 'API latency spike', severity: 'high', status: 'investigating' },
    { id: 'INC-002', title: 'Cache invalidation issue', severity: 'medium', status: 'monitoring' },
    { id: 'INC-003', title: 'Email delivery delay', severity: 'low', status: 'resolved' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Active Incidents
        </CardTitle>
        <CardDescription>Current platform incidents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={incident.severity === 'high' ? 'destructive' : 'secondary'}>
                    {incident.severity}
                  </Badge>
                  <span className="text-sm font-medium">{incident.id}</span>
                </div>
                <p className="text-sm text-muted-foreground">{incident.title}</p>
              </div>
              <Badge variant="outline">{incident.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SLADashboardWidget({ detailed: _detailed = false }: WidgetProps) {
  const metrics = [
    { name: 'API Response Time', current: '245ms', target: '<300ms', status: 'meeting' },
    { name: 'Uptime', current: '99.97%', target: '>99.95%', status: 'meeting' },
    { name: 'Error Rate', current: '0.03%', target: '<0.1%', status: 'meeting' },
    { name: 'Support Response', current: '12min', target: '<15min', status: 'meeting' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          SLA Performance
        </CardTitle>
        <CardDescription>Service level agreement compliance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.name} className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">{metric.name}</p>
              <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{metric.current}</p>
              <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ReleaseCalendarWidget({ detailed: _detailed = false }: WidgetProps) {
  const releases = [
    { version: 'v2.1.0', date: '2026-02-15', status: 'scheduled', features: 5 },
    { version: 'v2.0.5', date: '2026-02-11', status: 'deployed', features: 3 },
    { version: 'v2.0.4', date: '2026-02-08', status: 'deployed', features: 2 },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Release Calendar
        </CardTitle>
        <CardDescription>Upcoming and recent releases</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {releases.map((release) => (
            <div key={release.version} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div className="space-y-1">
                <p className="text-sm font-medium">{release.version}</p>
                <p className="text-xs text-muted-foreground">{release.features} features</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{release.date}</p>
                <Badge variant={release.status === 'deployed' ? 'default' : 'secondary'}>
                  {release.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CapacityOverviewWidget({ detailed: _detailed = false }: WidgetProps) {
  const resources = [
    { name: 'CPU', usage: 65, capacity: 100, unit: '%' },
    { name: 'Memory', usage: 72, capacity: 100, unit: '%' },
    { name: 'Database', usage: 45, capacity: 100, unit: 'GB' },
    { name: 'Storage', usage: 1.2, capacity: 5, unit: 'TB' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Capacity Overview
        </CardTitle>
        <CardDescription>Resource utilization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.map((resource) => (
          <div key={resource.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{resource.name}</span>
              <span className="text-muted-foreground">
                {resource.usage}{resource.unit} / {resource.capacity}{resource.unit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(resource.usage / resource.capacity) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
