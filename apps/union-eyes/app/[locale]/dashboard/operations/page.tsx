/**
 * Operations Dashboard
 * For Platform Lead, COO, CTO - Day-to-day platform operations
 *
 * @role platform_lead, coo, cto
 * @dashboard_path /dashboard/operations
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';

/* ── Types ── */
interface Service {
  serviceName: string;
  status: string;
  uptimePct: number;
  avgResponseMs: number | null;
  lastCheckedAt: string;
}

interface Incident {
  id: string;
  incidentNumber: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  serviceName: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  rootCause: string | null;
}

interface SlaMetric {
  metricName: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  period: string;
  measuredAt: string;
  status: string;
}

interface Release {
  id: string;
  version: string;
  title: string | null;
  status: string;
  releaseDate: string | null;
  featureCount: number;
  bugfixCount: number;
  notes: string | null;
  deployedBy: string | null;
}

interface Capacity {
  resourceName: string;
  currentUsage: number;
  totalCapacity: number;
  unit: string;
  thresholdWarning: number;
  thresholdCritical: number;
  measuredAt: string;
}

interface Overview {
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  activeIncidents: number;
  highSeverityIncidents: number;
  avgUptime: number;
  totalLoginsPast7d: number;
  slasMeeting: number;
  slasTotal: number;
  upcomingReleases: number;
}

/* ── Data loaders ── */
async function loadOverview(): Promise<Overview> {
  const [svcRows, incRows, loginRows, slaRows, relRows] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'healthy')::int as healthy,
        COUNT(*) FILTER (WHERE status = 'degraded')::int as degraded,
        ROUND(AVG(uptime_pct)::numeric, 3) as avg_uptime
      FROM platform_services
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as active,
        COUNT(*) FILTER (WHERE severity = 'high')::int as high_sev
      FROM platform_incidents
      WHERE status NOT IN ('resolved')
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as cnt
      FROM platform_login_events
      WHERE logged_in_at >= now() - interval '7 days'
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'meeting')::int as meeting
      FROM platform_sla_metrics
      WHERE measured_at >= date_trunc('month', now())
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as upcoming
      FROM platform_releases
      WHERE status = 'scheduled'
    `),
  ]);
  const svc = Array.from(svcRows)[0] as Record<string, unknown>;
  const inc = Array.from(incRows)[0] as Record<string, unknown>;
  const lgn = Array.from(loginRows)[0] as Record<string, unknown>;
  const sla = Array.from(slaRows)[0] as Record<string, unknown>;
  const rel = Array.from(relRows)[0] as Record<string, unknown>;
  return {
    totalServices: Number(svc.total),
    healthyServices: Number(svc.healthy),
    degradedServices: Number(svc.degraded),
    avgUptime: Number(svc.avg_uptime),
    activeIncidents: Number(inc.active),
    highSeverityIncidents: Number(inc.high_sev),
    totalLoginsPast7d: Number(lgn.cnt),
    slasMeeting: Number(sla.meeting),
    slasTotal: Number(sla.total),
    upcomingReleases: Number(rel.upcoming),
  };
}

async function loadServices(): Promise<Service[]> {
  return Array.from(
    await db.execute(sql`
      SELECT service_name, status, uptime_pct, avg_response_ms, last_checked_at
      FROM platform_services
      ORDER BY CASE status WHEN 'degraded' THEN 0 WHEN 'down' THEN 0 ELSE 1 END, service_name
    `)
  ).map((r: Record<string, unknown>) => ({
    serviceName: String(r.service_name),
    status: String(r.status),
    uptimePct: Number(r.uptime_pct),
    avgResponseMs: r.avg_response_ms != null ? Number(r.avg_response_ms) : null,
    lastCheckedAt: String(r.last_checked_at),
  }));
}

async function loadIncidents(statusFilter?: string): Promise<Incident[]> {
  if (statusFilter && statusFilter !== 'all') {
    return Array.from(
      await db.execute(sql`
        SELECT id, incident_number, title, description, severity, status,
          service_name, reported_at, resolved_at, duration_minutes, root_cause
        FROM platform_incidents
        WHERE status = ${statusFilter}
        ORDER BY reported_at DESC
      `)
    ).map(mapIncident);
  }
  return Array.from(
    await db.execute(sql`
      SELECT id, incident_number, title, description, severity, status,
        service_name, reported_at, resolved_at, duration_minutes, root_cause
      FROM platform_incidents
      ORDER BY reported_at DESC
    `)
  ).map(mapIncident);
}

function mapIncident(r: Record<string, unknown>): Incident {
  return {
    id: String(r.id),
    incidentNumber: String(r.incident_number),
    title: String(r.title),
    description: r.description ? String(r.description) : null,
    severity: String(r.severity),
    status: String(r.status),
    serviceName: r.service_name ? String(r.service_name) : null,
    reportedAt: String(r.reported_at),
    resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
    rootCause: r.root_cause ? String(r.root_cause) : null,
  };
}

async function loadSlaMetrics(): Promise<SlaMetric[]> {
  return Array.from(
    await db.execute(sql`
      SELECT metric_name, current_value, target_value, unit, period, measured_at, status
      FROM platform_sla_metrics
      ORDER BY measured_at DESC, metric_name
    `)
  ).map((r: Record<string, unknown>) => ({
    metricName: String(r.metric_name),
    currentValue: Number(r.current_value),
    targetValue: Number(r.target_value),
    unit: String(r.unit),
    period: String(r.period),
    measuredAt: String(r.measured_at),
    status: String(r.status),
  }));
}

async function loadReleases(): Promise<Release[]> {
  return Array.from(
    await db.execute(sql`
      SELECT id, version, title, status, release_date, feature_count, bugfix_count, notes, deployed_by
      FROM platform_releases
      ORDER BY release_date DESC NULLS LAST
    `)
  ).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    version: String(r.version),
    title: r.title ? String(r.title) : null,
    status: String(r.status),
    releaseDate: r.release_date ? String(r.release_date) : null,
    featureCount: Number(r.feature_count),
    bugfixCount: Number(r.bugfix_count),
    notes: r.notes ? String(r.notes) : null,
    deployedBy: r.deployed_by ? String(r.deployed_by) : null,
  }));
}

async function loadCapacity(): Promise<Capacity[]> {
  return Array.from(
    await db.execute(sql`
      SELECT resource_name, current_usage, total_capacity, unit,
        threshold_warning, threshold_critical, measured_at
      FROM platform_capacity
      ORDER BY (current_usage / total_capacity) DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    resourceName: String(r.resource_name),
    currentUsage: Number(r.current_usage),
    totalCapacity: Number(r.total_capacity),
    unit: String(r.unit),
    thresholdWarning: Number(r.threshold_warning),
    thresholdCritical: Number(r.threshold_critical),
    measuredAt: String(r.measured_at),
  }));
}

/* ── Helpers ── */
function severityColor(severity: string) {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    investigating: 'bg-red-100 text-red-800',
    monitoring: 'bg-yellow-100 text-yellow-800',
    open: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function capacityColor(pct: number, warn: number, crit: number) {
  if (pct >= crit) return 'bg-red-500';
  if (pct >= warn) return 'bg-yellow-500';
  return 'bg-green-500';
}

function serviceStatusIcon(status: string) {
  if (status === 'healthy') return '🟢';
  if (status === 'degraded') return '🟡';
  return '🔴';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Page ── */
export default async function OperationsDashboard(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const hasAccess = await hasMinRole('platform_lead');
  if (!hasAccess) redirect('/dashboard');

  const searchParams = await props.searchParams;
  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : 'overview';
  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : 'all';

  const [overview, services, incidents, slaMetrics, releases, capacity] = await withSystemContext(() =>
    Promise.all([
      loadOverview(),
      loadServices(),
      loadIncidents(tab === 'incidents' ? statusFilter : undefined),
      loadSlaMetrics(),
      loadReleases(),
      loadCapacity(),
    ])
  );

  const currentSla = slaMetrics.filter(m => {
    const d = new Date(m.measuredAt);
    return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
  });
  const previousSla = slaMetrics.filter(m => {
    const d = new Date(m.measuredAt);
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  });

  const tabs = ['overview', 'incidents', 'sla', 'releases', 'capacity'] as const;
  const tabLabels: Record<string, string> = {
    overview: 'Overview',
    incidents: 'Incidents',
    sla: 'SLA & Performance',
    releases: 'Releases',
    capacity: 'Capacity',
  };

  const incidentStatuses = ['all', 'investigating', 'monitoring', 'open', 'resolved'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Operations</h1>
        <p className="text-muted-foreground mt-1">
          Real-time platform health, incidents, and operational metrics
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(t => (
          <Link
            key={t}
            href={`?tab=${t}`}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {tabLabels[t]}
          </Link>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.healthyServices}/{overview.totalServices}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.degradedServices > 0
                    ? `${overview.degradedServices} degraded`
                    : 'All services healthy'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${overview.activeIncidents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {overview.activeIncidents}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.highSeverityIncidents > 0
                    ? `${overview.highSeverityIncidents} high severity`
                    : 'No high severity'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Platform Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.avgUptime}%</div>
                <p className="text-xs text-muted-foreground">
                  SLAs: {overview.slasMeeting}/{overview.slasTotal} meeting target
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Logins (7d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalLoginsPast7d}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.upcomingReleases} release{overview.upcomingReleases !== 1 ? 's' : ''} scheduled
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Service health + recent incidents side-by-side */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {services.map(s => (
                  <div key={s.serviceName} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{serviceStatusIcon(s.status)}</span>
                      <span className="text-sm">{s.serviceName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {s.avgResponseMs != null && <span>{s.avgResponseMs}ms</span>}
                      <span>{s.uptimePct}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                {incidents.filter(i => i.status !== 'resolved').length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active incidents</p>
                ) : (
                  <div className="space-y-3">
                    {incidents
                      .filter(i => i.status !== 'resolved')
                      .slice(0, 5)
                      .map(inc => (
                        <div key={inc.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={severityColor(inc.severity)}>{inc.severity}</Badge>
                              <span className="text-sm font-medium">{inc.incidentNumber}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{inc.title}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(inc.status)}`}>
                            {inc.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent releases */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Releases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {releases.slice(0, 4).map(rel => (
                  <div key={rel.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{rel.version}</span>
                        {rel.title && <span className="text-sm text-muted-foreground">— {rel.title}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rel.featureCount} features, {rel.bugfixCount} fixes
                      </p>
                    </div>
                    <div className="text-right">
                      {rel.releaseDate && (
                        <p className="text-xs text-muted-foreground">{formatDate(rel.releaseDate)}</p>
                      )}
                      <Badge variant={rel.status === 'deployed' ? 'default' : 'secondary'}>
                        {rel.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Incidents Tab ── */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2">
            {incidentStatuses.map(s => (
              <Link
                key={s}
                href={`?tab=incidents&status=${s}`}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Incidents {statusFilter !== 'all' && `— ${statusFilter}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">ID</th>
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Severity</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Service</th>
                      <th className="pb-2 font-medium">Reported</th>
                      <th className="pb-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map(inc => (
                      <tr key={inc.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{inc.incidentNumber}</td>
                        <td className="py-2 max-w-75">
                          <p className="font-medium">{inc.title}</p>
                          {inc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{inc.description}</p>
                          )}
                          {inc.rootCause && (
                            <p className="text-xs text-blue-600 mt-0.5">Root cause: {inc.rootCause}</p>
                          )}
                        </td>
                        <td className="py-2">
                          <Badge variant={severityColor(inc.severity)}>{inc.severity}</Badge>
                        </td>
                        <td className="py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(inc.status)}`}>
                            {inc.status}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{inc.serviceName ?? '—'}</td>
                        <td className="py-2 text-xs text-muted-foreground">{formatDateTime(inc.reportedAt)}</td>
                        <td className="py-2 text-xs">
                          {inc.durationMinutes != null
                            ? `${Math.floor(inc.durationMinutes / 60)}h ${inc.durationMinutes % 60}m`
                            : inc.status === 'resolved'
                              ? '—'
                              : 'Ongoing'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SLA & Performance Tab ── */}
      {tab === 'sla' && (
        <div className="space-y-6">
          {/* Current month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Current Month — {new Date().toLocaleString('en-CA', { month: 'long', year: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {currentSla.map(m => (
                  <div key={m.metricName} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{m.metricName}</p>
                      <p className="text-xs text-muted-foreground">
                        Target: {m.targetValue}{m.unit === '%' || m.unit === 'ms' || m.unit === 'seconds' ? '' : ' '}{m.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{m.currentValue}{m.unit === '%' || m.unit === 'ms' || m.unit === 'seconds' ? '' : ' '}{m.unit}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        m.status === 'meeting' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Previous month comparison */}
          {previousSla.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Previous Month — {(() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    return d.toLocaleString('en-CA', { month: 'long', year: 'numeric' });
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Metric</th>
                        <th className="pb-2 font-medium">Value</th>
                        <th className="pb-2 font-medium">Target</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previousSla.map(m => (
                        <tr key={m.metricName} className="border-b last:border-0">
                          <td className="py-2 font-medium">{m.metricName}</td>
                          <td className="py-2">{m.currentValue}{m.unit === '%' || m.unit === 'ms' || m.unit === 'seconds' ? '' : ' '}{m.unit}</td>
                          <td className="py-2 text-muted-foreground">{m.targetValue}{m.unit === '%' || m.unit === 'ms' || m.unit === 'seconds' ? '' : ' '}{m.unit}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              m.status === 'meeting' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Releases Tab ── */}
      {tab === 'releases' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Release History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {releases.map(rel => (
                  <div key={rel.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold font-mono">{rel.version}</span>
                        <Badge variant={rel.status === 'deployed' ? 'default' : 'secondary'}>
                          {rel.status}
                        </Badge>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {rel.releaseDate && formatDate(rel.releaseDate)}
                        {rel.deployedBy && <span className="ml-2">by {rel.deployedBy}</span>}
                      </div>
                    </div>
                    {rel.title && <p className="font-medium">{rel.title}</p>}
                    {rel.notes && <p className="text-sm text-muted-foreground">{rel.notes}</p>}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{rel.featureCount} feature{rel.featureCount !== 1 ? 's' : ''}</span>
                      <span>{rel.bugfixCount} bugfix{rel.bugfixCount !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Capacity Tab ── */}
      {tab === 'capacity' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resource Utilization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {capacity.map(c => {
                const pct = (c.currentUsage / c.totalCapacity) * 100;
                return (
                  <div key={c.resourceName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.resourceName}</span>
                      <span className="text-muted-foreground">
                        {c.currentUsage} / {c.totalCapacity} {c.unit}
                        <span className="ml-2 font-mono">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${capacityColor(pct, c.thresholdWarning, c.thresholdCritical)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Warning: {c.thresholdWarning}%</span>
                      <span>Critical: {c.thresholdCritical}%</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Capacity summary */}
          <div className="grid gap-4 md:grid-cols-3">
            {capacity.map(c => {
              const pct = (c.currentUsage / c.totalCapacity) * 100;
              const atRisk = pct >= c.thresholdWarning;
              return (
                <Card key={c.resourceName} className={atRisk ? 'border-yellow-400' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{c.resourceName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${pct >= c.thresholdCritical ? 'text-red-600' : pct >= c.thresholdWarning ? 'text-yellow-600' : 'text-green-600'}`}>
                      {pct.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.currentUsage} {c.unit} of {c.totalCapacity} {c.unit}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
