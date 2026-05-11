/**
 * System Status Page Component
 * 
 * Public-facing status page showing service health
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import type { SystemStatus, ServiceHealth, ServiceStatus } from '@/lib/monitoring';
import { getStatusColor, getStatusEmoji, formatUptime } from '@/lib/monitoring';

export interface StatusLabels {
  systemStatus: string;
  statusDescription: string;
  allOperational: string;
  someDegraded: string;
  systemIssues: string;
  systemInformation: string;
  uptime: string;
  version: string;
  timestamp: string;
  services: string;
  monitored: string;
  responseTime: string;
  statusLabel: string;
  lastChecked: string;
  loadError: string;
}

const defaultStatusLabels: StatusLabels = {
  systemStatus: "System Status",
  statusDescription: "Current operational status of all services",
  allOperational: "No Degradation Reported",
  someDegraded: "Degraded Performance",
  systemIssues: "System Issues",
  systemInformation: "System Information",
  uptime: "Uptime",
  version: "Version",
  timestamp: "Timestamp",
  services: "Services",
  monitored: "monitored",
  responseTime: "Response Time:",
  statusLabel: "Status:",
  lastChecked: "Last Checked:",
  loadError: "Failed to load system status",
};

export function StatusPage({ labels: labelsProp }: { labels?: StatusLabels } = {}) {
  const l = labelsProp ?? defaultStatusLabels;
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
      setLastUpdate(new Date());
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <StatusPageSkeleton />;
  }

  if (!status) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {l.loadError}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{l.systemStatus}</CardTitle>
              <CardDescription>
                {l.statusDescription}
              </CardDescription>
            </div>
            <button
              onClick={fetchStatus}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Refresh status"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{getStatusEmoji(status.status)}</span>
              <div>
                <h3 className="text-xl font-semibold capitalize">
                  {status.status === 'healthy' ? l.allOperational : 
                   status.status === 'degraded' ? l.someDegraded :
                   l.systemIssues}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <StatusBadge status={status.status} />
          </div>
        </CardContent>
      </Card>

      {/* Service Details */}
      <div className="grid gap-4 md:grid-cols-2">
        {status.services.map((service) => (
          <ServiceCard key={service.name} service={service} labels={l} />
        ))}
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>{l.systemInformation}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">{l.uptime}</dt>
              <dd className="mt-1">{formatUptime(status.uptime)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">{l.version}</dt>
              <dd className="mt-1">{status.version}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">{l.timestamp}</dt>
              <dd className="mt-1">
                {new Date(status.timestamp).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">{l.services}</dt>
              <dd className="mt-1">{status.services.length} {l.monitored}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceCard({ service, labels }: { service: ServiceHealth; labels: StatusLabels }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{service.name}</CardTitle>
          <StatusBadge status={service.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {service.responseTime && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.responseTime}</span>
              <span className="font-medium">{service.responseTime}ms</span>
            </div>
          )}
          {service.message && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{labels.statusLabel}</span>
              <span className="font-medium">{service.message}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{labels.lastChecked}</span>
            <span className="font-medium">
              {new Date(service.lastChecked).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const color = getStatusColor(status);
  const emoji = getStatusEmoji(status);

  const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
    green: 'default',
    yellow: 'secondary',
    red: 'destructive',
  };

  return (
    <Badge variant={variants[color] || 'secondary'}>
      {emoji} {status}
    </Badge>
  );
}

function StatusPageSkeleton() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

