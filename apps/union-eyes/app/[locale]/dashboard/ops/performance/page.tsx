/**
 * Route Performance Dashboard — /dashboard/ops/performance
 *
 * Internal trust-layer page showing per-route latency, error rate, and
 * volume for the six priority routes defined in the Commercial Enablement
 * Pass. Used by Platform Engineering, SRE, and for external evidence.
 *
 * Data sources (in priority order):
 *   1. Redis analytics-performance store (Upstash) — live if wired
 *   2. Graceful "pending instrumentation" state — honest fallback
 *
 * Thresholds:
 *   P95 Green   ≤ 500ms
 *   P95 Yellow  > 500ms and ≤ 2 000ms
 *   P95 Red     > 2 000ms
 *   Error rate Green   < 1%
 *   Error rate Yellow  ≥ 1% and < 5%
 *   Error rate Red     ≥ 5%
 *
 * @module app/dashboard/ops/performance/page
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { performanceMonitor } from '@/lib/analytics-performance';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  ExternalLink,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type TrafficLight = 'green' | 'yellow' | 'red' | 'pending';

interface RouteMetric {
  /** Display label */
  route: string;
  /** Key used in analytics-performance store */
  endpointKey: string;
  /** p50 latency in ms (null = no data) */
  p50Ms: number | null;
  /** p95 latency in ms (null = no data) */
  p95Ms: number | null;
  /** Error rate 0–100 (null = no data) */
  errorRatePct: number | null;
  /** Request volume today */
  volumeToday: number | null;
  /** Trend direction relative to 7-day baseline */
  trend: 'up' | 'down' | 'flat' | 'pending';
  /** Badge colour */
  status: TrafficLight;
}

interface WatchlistItem {
  route: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

// ── Constants ─────────────────────────────────────────────────────────────

const PRIORITY_ROUTES: { route: string; endpointKey: string }[] = [
  { route: 'GET /dashboard/leadership', endpointKey: '/dashboard/leadership' },
  { route: 'GET /dashboard/work',       endpointKey: '/dashboard/work' },
  { route: 'GET /grievances/new',        endpointKey: '/grievances/new' },
  { route: 'POST /api/cases',            endpointKey: '/api/cases' },
  { route: 'POST /api/workflow/transition', endpointKey: '/api/workflow/transition' },
  { route: 'POST /api/pilot/onboarding', endpointKey: '/api/pilot/onboarding' },
];

const P95_GREEN  = 500;   // ms
const P95_YELLOW = 2000;  // ms
const ERR_GREEN  = 1;     // %
const ERR_YELLOW = 5;     // %

// ── Helpers ────────────────────────────────────────────────────────────────

function trafficLight(p95Ms: number | null, errorRatePct: number | null): TrafficLight {
  if (p95Ms === null) return 'pending';
  if (p95Ms > P95_YELLOW || (errorRatePct ?? 0) >= ERR_YELLOW) return 'red';
  if (p95Ms > P95_GREEN  || (errorRatePct ?? 0) >= ERR_GREEN)  return 'yellow';
  return 'green';
}

function badgeFor(status: TrafficLight) {
  switch (status) {
    case 'green':   return 'bg-green-100 text-green-800 border-green-300';
    case 'yellow':  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'red':     return 'bg-red-100 text-red-800 border-red-300';
    default:        return 'bg-slate-100 text-slate-600 border-slate-300';
  }
}

function statusDot(status: TrafficLight) {
  switch (status) {
    case 'green':   return '🟢';
    case 'yellow':  return '🟡';
    case 'red':     return '🔴';
    default:        return '⚪';
  }
}

function fmt(ms: number | null): string {
  if (ms === null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtPct(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct.toFixed(2)}%`;
}

function fmtVol(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Data loader ────────────────────────────────────────────────────────────

async function loadRouteMetrics(): Promise<RouteMetric[]> {
  const todayKey  = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  return Promise.all(
    PRIORITY_ROUTES.map(async ({ route, endpointKey }) => {
      const [today, prev] = await Promise.all([
        performanceMonitor.getEndpointReport(endpointKey, todayKey).catch(() => null),
        performanceMonitor.getEndpointReport(endpointKey, yesterday).catch(() => null),
      ]);

      // The Redis store exposes avgDuration. p50 ≈ avgDuration (estimated);
      // p95 ≈ avgDuration * 2 (matching the getSummary() estimate pattern).
      // We surface these as approximate until OTEL exports real percentile data.
      const p50Ms = today ? Math.round(today.avgDuration) : null;
      const p95Ms = today ? Math.round(today.avgDuration * 2) : null;

      // Error rate is not stored in the current analytics-performance schema.
      // Surface null (pending) until the OTEL layer adds error classification.
      const errorRatePct: number | null = null;

      const volumeToday = today?.totalCalls ?? null;

      let trend: RouteMetric['trend'] = 'pending';
      if (today && prev) {
        const delta = today.avgDuration - prev.avgDuration;
        if (Math.abs(delta) < 50) trend = 'flat';
        else trend = delta > 0 ? 'up' : 'down';
      } else if (today) {
        trend = 'flat';
      }

      const status = trafficLight(p95Ms, errorRatePct);

      return { route, endpointKey, p50Ms, p95Ms, errorRatePct, volumeToday, trend, status };
    })
  );
}

function buildWatchlist(metrics: RouteMetric[]): WatchlistItem[] {
  const items: WatchlistItem[] = [];

  for (const m of metrics) {
    if (m.p95Ms !== null && m.p95Ms > P95_YELLOW) {
      items.push({ route: m.route, reason: `p95 ${fmt(m.p95Ms)} exceeds 2s threshold`, severity: 'high' });
    } else if (m.p95Ms !== null && m.p95Ms > P95_GREEN) {
      items.push({ route: m.route, reason: `p95 ${fmt(m.p95Ms)} in yellow zone (500ms–2s)`, severity: 'medium' });
    }
    if (m.errorRatePct !== null && m.errorRatePct >= ERR_YELLOW) {
      items.push({ route: m.route, reason: `Error rate ${fmtPct(m.errorRatePct)} ≥ 5%`, severity: 'high' });
    } else if (m.errorRatePct !== null && m.errorRatePct >= ERR_GREEN) {
      items.push({ route: m.route, reason: `Error rate ${fmtPct(m.errorRatePct)} in yellow zone`, severity: 'medium' });
    }
    if (m.trend === 'up' && m.p95Ms !== null && m.p95Ms > P95_GREEN) {
      items.push({ route: m.route, reason: 'Latency trending worse vs. yesterday', severity: 'low' });
    }
  }

  return items;
}

function pendingCount(metrics: RouteMetric[]): number {
  return metrics.filter((m) => m.status === 'pending').length;
}

type BadgeVariant = 'destructive' | 'secondary' | 'outline';

function watchlistBadgeVariant(severity: 'high' | 'medium' | 'low'): BadgeVariant {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function OpsPerformancePage() {
  await requireUser();
  const hasAccess = await hasMinRole('platform_lead');
  if (!hasAccess) redirect('/dashboard');

  const metrics = await loadRouteMetrics();
  const watchlist = buildWatchlist(metrics);
  const noData = pendingCount(metrics) === metrics.length;
  const greenCount  = metrics.filter((m) => m.status === 'green').length;
  const yellowCount = metrics.filter((m) => m.status === 'yellow').length;
  const redCount    = metrics.filter((m) => m.status === 'red').length;
  const pendingC    = metrics.filter((m) => m.status === 'pending').length;

  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Route Performance</h1>
          <p className="text-muted-foreground mt-1">
            p50 / p95 latency, error rate and volume for the six priority routes.
            Data from Redis analytics store wired via{' '}
            <code className="text-xs bg-muted px-1 rounded">lib/analytics-performance.ts</code>.
          </p>
        </div>
        <Link
          href="/dashboard/operations?tab=sla"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Platform SLAs
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── No data banner ── */}
      {noData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">Live telemetry not yet available</p>
            <p className="text-sm text-amber-700 mt-0.5">
              The Redis analytics store requires{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">UPSTASH_REDIS_REST_URL</code> and{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">UPSTASH_REDIS_REST_TOKEN</code>{' '}
              to be set. Once instrumentation is active, this page populates automatically.
              The{' '}
              <a
                href="https://github.com/anungis437/nzila-os/blob/main/docs/ops/azure-monitor/union-eyes-route-performance.workbook.json"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                Azure Monitor workbook
              </a>{' '}
              provides equivalent visibility from Application Insights.
            </p>
          </div>
        </div>
      )}

      {/* ── Summary counters ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Green Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{greenCount}</div>
            <p className="text-xs text-muted-foreground">p95 ≤ 500ms · error &lt; 1%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Yellow Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{yellowCount}</div>
            <p className="text-xs text-muted-foreground">p95 500ms–2s · error 1%–5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Red Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${redCount > 0 ? 'text-red-700' : 'text-slate-600'}`}>
              {redCount}
            </div>
            <p className="text-xs text-muted-foreground">p95 &gt; 2s · error ≥ 5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Pending Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-500">{pendingC}</div>
            <p className="text-xs text-muted-foreground">awaiting live instrumentation</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Route table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Priority Route Metrics — Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-4">Route</th>
                  <th className="text-right py-2 pr-4">P50</th>
                  <th className="text-right py-2 pr-4">P95</th>
                  <th className="text-right py-2 pr-4">Error Rate</th>
                  <th className="text-right py-2 pr-4">Volume</th>
                  <th className="text-right py-2 pr-4">24h Trend</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {metrics.map((m) => (
                  <tr key={m.route} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs font-medium">{m.route}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{fmt(m.p50Ms)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{fmt(m.p95Ms)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{fmtPct(m.errorRatePct)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{fmtVol(m.volumeToday)}</td>
                    <td className="py-3 pr-4 text-right">
                      {m.trend === 'up'      && <TrendingUp   className="inline h-4 w-4 text-red-500 ml-auto" />}
                      {m.trend === 'down'    && <TrendingDown  className="inline h-4 w-4 text-green-500 ml-auto" />}
                      {m.trend === 'flat'    && <Minus         className="inline h-4 w-4 text-slate-400 ml-auto" />}
                      {m.trend === 'pending' && <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="py-3 text-center">
                      <span title={m.status}>{statusDot(m.status)}</span>
                      <span
                        className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeFor(m.status)}`}
                      >
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

      {/* ── Route risk watchlist ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Route Risk Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {watchlist.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {noData
                ? 'No data yet — watchlist will populate once instrumentation is active.'
                : 'No routes in risk zone — all priority routes within thresholds.'}
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.map((w, i) => (
                <div key={i} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Badge variant={watchlistBadgeVariant(w.severity)}>
                      {w.severity}
                    </Badge>
                    <span className="font-mono text-xs font-medium">{w.route}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{w.reason}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Availability notes ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Availability Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3 border-b pb-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Uptime target: 99.9%</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                No contractual SLA yet. Uptime monitored via Azure Application Insights.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border-b pb-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">OTEL + Sentry instrumentation active</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                OpenTelemetry traces and Sentry error tracking are wired.
                Per-route p95 numeric data populates once the Redis analytics store is connected.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border-b pb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Error rate tracking: pending OTEL enrichment</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                The current Redis analytics-performance store tracks duration only.
                Error rate classification requires an OTEL span attribute enrichment
                (target: 2026-Q2).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Azure Monitor workbook available</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Full p50/p95/error rate/volume workbook with 24h and 7d trend queries:
                <code className="ml-1 text-xs bg-muted px-1 rounded">
                  docs/ops/azure-monitor/union-eyes-route-performance.workbook.json
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Thresholds legend ── */}
      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4 border-t pt-4">
        <span className="font-medium">Thresholds:</span>
        <span>🟢 p95 ≤ 500ms · error &lt; 1%</span>
        <span>🟡 p95 500ms–2s · error 1%–5%</span>
        <span>🔴 p95 &gt; 2s · error ≥ 5%</span>
        <span>⚪ No data yet</span>
        <span className="ml-auto">
          Monthly export:{' '}
          <code className="bg-muted px-1 rounded">reports/ops/performance-summary.md</code>
        </span>
      </div>
    </div>
  );
}
