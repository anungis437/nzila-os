/**
 * Security Dashboard
 * For Security Manager - Security events, threats, access monitoring
 *
 * @role security_manager
 * @dashboard_path /dashboard/security
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Shield, AlertTriangle, Activity, XCircle, Lock, Eye, Clock, CheckCircle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getTranslations } from 'next-intl/server';

// ── Types ──────────────────────────────────────────────────────────────────

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  status: string;
  sourceIp: string | null;
  userEmail: string | null;
  description: string;
  resource: string | null;
  actionTaken: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface PostureCheck {
  id: string;
  checkName: string;
  category: string;
  status: string;
  score: number | null;
  details: string | null;
  lastCheckedAt: string;
}

interface SecurityStats {
  totalEvents: number;
  criticalAlerts: number;
  highAlerts: number;
  blockedThreats: number;
  openIncidents: number;
  investigatingCount: number;
  resolvedCount: number;
  securityScore: number;
  eventsByType: Record<string, number>;
  posturePass: number;
  postureWarn: number;
  postureFail: number;
}

// ── Data loaders ───────────────────────────────────────────────────────────

async function loadSecurityEvents(orgId: string): Promise<SecurityEvent[]> {
  const result = await db.execute(sql`
    SELECT id, event_type, severity, status, source_ip, user_email,
           description, resource, action_taken, resolved_by, resolved_at, created_at
    FROM security_events
    WHERE organization_id = ${orgId}::uuid
    ORDER BY created_at DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    severity: r.severity as string,
    status: r.status as string,
    sourceIp: r.source_ip as string | null,
    userEmail: r.user_email as string | null,
    description: r.description as string,
    resource: r.resource as string | null,
    actionTaken: r.action_taken as string | null,
    resolvedBy: r.resolved_by as string | null,
    resolvedAt: r.resolved_at as string | null,
    createdAt: r.created_at as string,
  }));
}

async function loadPostureChecks(orgId: string): Promise<PostureCheck[]> {
  const result = await db.execute(sql`
    SELECT id, check_name, category, status, score, details, last_checked_at
    FROM security_posture_checks
    WHERE organization_id = ${orgId}::uuid
    ORDER BY
      CASE status WHEN 'fail' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,
      category
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    checkName: r.check_name as string,
    category: r.category as string,
    status: r.status as string,
    score: r.score ? Number(r.score) : null,
    details: r.details as string | null,
    lastCheckedAt: r.last_checked_at as string,
  }));
}

function computeStats(events: SecurityEvent[], posture: PostureCheck[]): SecurityStats {
  const criticalAlerts = events.filter(e => e.severity === 'critical').length;
  const highAlerts = events.filter(e => e.severity === 'high').length;
  const blockedThreats = events.filter(e => e.status === 'blocked').length;
  const openIncidents = events.filter(e => e.status === 'open').length;
  const investigatingCount = events.filter(e => e.status === 'investigating').length;
  const resolvedCount = events.filter(e => e.status === 'resolved').length;

  const eventsByType: Record<string, number> = {};
  for (const e of events) {
    eventsByType[e.eventType] = (eventsByType[e.eventType] ?? 0) + 1;
  }

  const posturePass = posture.filter(p => p.status === 'pass').length;
  const postureWarn = posture.filter(p => p.status === 'warn').length;
  const postureFail = posture.filter(p => p.status === 'fail').length;

  const avgScore = posture.length > 0
    ? posture.reduce((sum, p) => sum + (p.score ?? 100), 0) / posture.length
    : 100;

  return {
    totalEvents: events.length,
    criticalAlerts,
    highAlerts,
    blockedThreats,
    openIncidents,
    investigatingCount,
    resolvedCount,
    securityScore: Math.round(avgScore * 10) / 10,
    eventsByType,
    posturePass,
    postureWarn,
    postureFail,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function severityVariant(severity: string) {
  switch (severity) {
    case 'critical': return 'destructive' as const;
    case 'high': return 'destructive' as const;
    case 'medium': return 'secondary' as const;
    default: return 'outline' as const;
  }
}

function statusVariant(status: string) {
  switch (status) {
    case 'blocked': return 'default' as const;
    case 'resolved': return 'default' as const;
    case 'open': return 'destructive' as const;
    case 'investigating': return 'secondary' as const;
    default: return 'outline' as const;
  }
}

function formatEventType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function makeTimeAgo(t: (k: string, v?: Record<string, string | number | Date>) => string) {
  return function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('timeAgoMins', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('timeAgoHours', { count: hours });
    const days = Math.floor(hours / 24);
    return t('timeAgoDays', { count: days });
  };
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function SecurityDashboard({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; severity?: string; status?: string }>;
}) {
  const { locale } = await paramsPromise;
  const t = await getTranslations('securityPage');
  const params = await searchParams;
  const activeTab = params.tab ?? 'overview';
  const filterSeverity = params.severity ?? null;
  const filterStatus = params.status ?? null;

  const user = await requireUser();

  const hasAccess = await hasMinRole('security_manager');
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  const organizationId = user.organizationId;

  let events: SecurityEvent[] = [];
  let posture: PostureCheck[] = [];

  if (organizationId) {
    try {
      [events, posture] = await withSystemContext(() =>
        Promise.all([
          loadSecurityEvents(organizationId),
          loadPostureChecks(organizationId),
        ])
      );
    } catch (error) {
      logger.error('Error loading security data:', error);
    }
  }

  const stats = computeStats(events, posture);
  const timeAgo = makeTimeAgo(t);

  // Filtered views for tabs
  const alertEvents = filterSeverity
    ? events.filter(e => e.severity === filterSeverity)
    : events.filter(e => e.severity === 'critical' || e.severity === 'high');

  const threatEvents = events.filter(e => e.status === 'blocked');

  const accessEvents = filterStatus
    ? events.filter(e => e.status === filterStatus)
    : events;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Link href={`/${locale}/dashboard/security`} className="no-underline">{t('tabOverview')}</Link>
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Link href={`/${locale}/dashboard/security?tab=alerts`} className="no-underline">
              {t('tabAlerts')} {stats.criticalAlerts + stats.highAlerts > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs">{stats.criticalAlerts + stats.highAlerts}</Badge>
              )}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="threats">
            <Link href={`/${locale}/dashboard/security?tab=threats`} className="no-underline">{t('tabThreats', { count: stats.blockedThreats })}</Link>
          </TabsTrigger>
          <TabsTrigger value="access">
            <Link href={`/${locale}/dashboard/security?tab=access`} className="no-underline">{t('tabAccess')}</Link>
          </TabsTrigger>
          <TabsTrigger value="posture">
            <Link href={`/${locale}/dashboard/security?tab=posture`} className="no-underline">{t('tabPosture')}</Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href={`/${locale}/dashboard/security?tab=posture`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('securityScoreTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.securityScore >= 90 ? 'text-green-600' : stats.securityScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats.securityScore}%
                  </div>
                  <p className="text-xs text-muted-foreground">{t('checksPassingLabel', { pass: stats.posturePass, total: posture.length })}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/security?tab=alerts&severity=critical`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t('criticalAlertsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.criticalAlerts > 0 ? 'text-red-600' : ''}`}>
                    {stats.criticalAlerts}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('highSeverityLabel', { count: stats.highAlerts })}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/security?tab=threats`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {t('blockedThreatsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.blockedThreats}</div>
                  <p className="text-xs text-muted-foreground">{t('autoMitigatedLabel')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/security?tab=access`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {t('securityEventsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalEvents}</div>
                  <p className="text-xs text-muted-foreground">{t('totalMonitoredLabel')}</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('threatDetectionTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.eventsByType)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm">{formatEventType(type)}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                  {Object.keys(stats.eventsByType).length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('noEventsRecorded')}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('incidentStatusTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href={`/${locale}/dashboard/security?tab=access&status=open`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('statusOpen')}</span>
                    <Badge variant="destructive">{stats.openIncidents}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/security?tab=access&status=investigating`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('statusInvestigating')}</span>
                    <Badge variant="secondary">{stats.investigatingCount}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/security?tab=access&status=blocked`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('statusBlocked')}</span>
                    <Badge variant="default">{stats.blockedThreats}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/security?tab=access&status=resolved`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('statusResolved')}</span>
                    <Badge variant="outline">{stats.resolvedCount}</Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Posture Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t('postureTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {posture.map((check) => (
                  <div key={check.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{check.checkName}</span>
                      <Badge
                        variant={check.status === 'pass' ? 'default' : check.status === 'warn' ? 'secondary' : 'destructive'}
                        className={check.status === 'pass' ? 'bg-green-600' : ''}
                      >
                        {check.status === 'pass' ? t('postureActive') : check.status === 'warn' ? t('postureWarning') : t('postureFailed')}
                      </Badge>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          check.status === 'pass' ? 'bg-green-600' :
                          check.status === 'warn' ? 'bg-yellow-500' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${check.score ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                {posture.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('noPostureConfigured')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Alerts Tab ───────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('alertsTitle')}</CardTitle>
                {filterSeverity ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('filteredLabel', { value: filterSeverity })}</Badge>
                    <Link href={`/${locale}/dashboard/security?tab=alerts`} className="text-xs text-muted-foreground hover:text-foreground">
                      {t('clearFilter')}
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href={`/${locale}/dashboard/security?tab=alerts&severity=critical`}>
                      <Badge variant="destructive" className="cursor-pointer hover:opacity-80">Critical ({stats.criticalAlerts})</Badge>
                    </Link>
                    <Link href={`/${locale}/dashboard/security?tab=alerts&severity=high`}>
                      <Badge variant="secondary" className="cursor-pointer hover:opacity-80">High ({stats.highAlerts})</Badge>
                    </Link>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {alertEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle className="h-10 w-10 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('noAlertsFilter')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={severityVariant(event.severity)}>
                            {event.severity}
                          </Badge>
                          <span className="text-sm font-medium">{formatEventType(event.eventType)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {event.sourceIp && <span>{event.sourceIp}</span>}
                          {event.userEmail && <><span>&bull;</span><span>{event.userEmail}</span></>}
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(event.createdAt)}
                          </span>
                        </div>
                        {event.actionTaken && (
                          <p className="text-xs text-muted-foreground italic">{t('actionLabel', { value: event.actionTaken })}</p>
                        )}
                      </div>
                      <Badge variant={statusVariant(event.status)} className="shrink-0">
                        {event.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Threats Tab ──────────────────────────────────────────────── */}
        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle>{t('threatsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {threatEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <Shield className="h-10 w-10 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('noThreatsDetected')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {threatEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={severityVariant(event.severity)}>
                            {event.severity}
                          </Badge>
                          <span className="text-sm font-medium">{formatEventType(event.eventType)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {event.sourceIp && <span>{t('sourceLabel', { value: event.sourceIp })}</span>}
                          {event.resource && <><span>&bull;</span><span>{t('targetLabel', { value: event.resource })}</span></>}
                          <span>&bull;</span>
                          <span>{timeAgo(event.createdAt)}</span>
                        </div>
                        {event.actionTaken && (
                          <p className="text-xs text-muted-foreground italic">{t('mitigationLabel', { value: event.actionTaken })}</p>
                        )}
                      </div>
                      <Badge variant="default" className="bg-red-600 shrink-0">{t('statusBlocked')}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Access Logs Tab ──────────────────────────────────────────── */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('accessTitle')}</CardTitle>
                {filterStatus && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('filteredLabel', { value: filterStatus })}</Badge>
                    <Link href={`/${locale}/dashboard/security?tab=access`} className="text-xs text-muted-foreground hover:text-foreground">
                      {t('clearFilter')}
                    </Link>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {accessEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noAccessLogs')}</p>
              ) : (
                <div className="space-y-3">
                  {accessEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{event.userEmail ?? t('unknownUser')}</span>
                          <Badge variant="outline" className="text-xs">{formatEventType(event.eventType)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {event.resource && <span>{event.resource}</span>}
                          {event.sourceIp && <><span>&bull;</span><span>{event.sourceIp}</span></>}
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(event.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={statusVariant(event.status)} className="shrink-0">
                        {event.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Posture Tab ──────────────────────────────────────────────── */}
        <TabsContent value="posture" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('posturePassTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.posturePass}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('postureWarnTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.postureWarn}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('postureFailTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.postureFail}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('postureChecksTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {posture.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noPostureConfigured')}</p>
              ) : (
                <div className="space-y-4">
                  {posture.map((check) => (
                    <div key={check.id} className="border-b pb-4 last:border-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{check.checkName}</span>
                          <Badge variant="outline" className="text-xs">{check.category.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {check.score !== null && (
                            <span className="text-sm font-bold">{check.score}%</span>
                          )}
                          <Badge
                            variant={check.status === 'pass' ? 'default' : check.status === 'warn' ? 'secondary' : 'destructive'}
                            className={check.status === 'pass' ? 'bg-green-600' : ''}
                          >
                            {check.status === 'pass' ? t('postureStatusPass') : check.status === 'warn' ? t('postureStatusWarn') : t('postureStatusFail')}
                          </Badge>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            check.status === 'pass' ? 'bg-green-600' :
                            check.status === 'warn' ? 'bg-yellow-500' :
                            'bg-red-600'
                          }`}
                          style={{ width: `${check.score ?? 0}%` }}
                        />
                      </div>
                      {check.details && (
                        <p className="text-xs text-muted-foreground">{check.details}</p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {t('lastCheckedLabel', { time: timeAgo(check.lastCheckedAt) })}
                      </p>
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
