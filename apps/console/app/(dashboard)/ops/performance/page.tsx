/**
 * Nzila OS — Console: UX Performance Telemetry
 *
 * Real, in-process telemetry surface for the Console itself.
 *
 *   - Web Vitals (LCP / INP / CLS / TTFB / FCP) collected by the
 *     in-page reporter at /api/_perf/vitals.
 *   - Server route timings can be fed via `recordRoute()` from any
 *     server action or instrumentation layer that wants to report.
 *   - Failed actions are auto-derived from any 5xx route samples.
 *
 * Multi-replica caveat: each replica holds its own ring; values
 * here reflect the slice this replica observed. The page surfaces
 * sample counts so operators can judge confidence honestly.
 */
import { requireRole } from '@/lib/rbac'
import Link from 'next/link'
import {
  ChartBarSquareIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CursorArrowRaysIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  KpiTile,
  EmptyState,
  Badge,
  StatusPill,
} from '@/components/ui'
import {
  summarizeVitals,
  summarizeRoutes,
  summarizeFailedActions,
  isCollecting,
  type VitalSummary,
} from '@/lib/perf/store'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'UX Performance | Nzila Console',
}

interface PageProps {
  searchParams: Promise<{ window?: string }>
}

const WINDOWS: Record<string, { label: string; ms: number }> = {
  '24h': { label: '24h', ms: 24 * 60 * 60 * 1000 },
  '7d':  { label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  '30d': { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
}

const VITAL_BUDGETS: Record<VitalSummary['name'], { good: number; poor: number; format: (v: number) => string }> = {
  LCP:  { good: 2500, poor: 4000, format: v => `${(v / 1000).toFixed(2)}s` },
  INP:  { good: 200,  poor: 500,  format: v => `${Math.round(v)}ms` },
  CLS:  { good: 100,  poor: 250,  format: v => (v / 1000).toFixed(3) }, // stored *1000
  TTFB: { good: 800,  poor: 1800, format: v => `${Math.round(v)}ms` },
  FCP:  { good: 1800, poor: 3000, format: v => `${(v / 1000).toFixed(2)}s` },
}

function vitalStatus(name: VitalSummary['name'], value: number | null): 'healthy' | 'degraded' | 'down' | 'unknown' {
  if (value === null) return 'unknown'
  const b = VITAL_BUDGETS[name]
  if (value <= b.good) return 'healthy'
  if (value <= b.poor) return 'degraded'
  return 'down'
}

export default async function UxPerformancePage({ searchParams }: PageProps) {
  await requireRole('ops')
  const sp = await searchParams
  const winKey = (sp.window && WINDOWS[sp.window]) ? sp.window : '24h'
  const win = WINDOWS[winKey]

  const vitals = summarizeVitals(win.ms)
  const routes = summarizeRoutes(win.ms)
  const failed = summarizeFailedActions()
  const collecting = isCollecting()

  const totalSamples = vitals.reduce((sum, v) => sum + v.count, 0)

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="UX Performance"
        description="Measured user-facing performance for the Console itself: Web Vitals, render times, and failed actions."
        badges={
          <span className="inline-flex items-center gap-2">
            <Badge tone={collecting ? 'green' : 'amber'}>
              {collecting ? `Live · ${totalSamples} samples` : 'Awaiting first sample'}
            </Badge>
            <Badge tone="gray">Window: {win.label}</Badge>
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            {Object.keys(WINDOWS).map(k => (
              <Link
                key={k}
                href={`?window=${k}`}
                className={
                  'inline-flex items-center h-8 px-3 rounded-md text-xs font-medium transition ' +
                  (k === winKey
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50')
                }
              >
                {WINDOWS[k].label}
              </Link>
            ))}
            <Link
              href="/docs/observability"
              className="ml-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Runbook
            </Link>
          </div>
        }
      />

      {!collecting ? (
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <SignalIcon className="h-5 w-5 text-amber-500 flex-none mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">No samples yet — telemetry is live but no users have hit instrumented pages this window.</p>
                <p className="mt-1 text-gray-600">
                  Web Vitals stream into <code className="bg-gray-100 px-1 rounded text-xs">/api/_perf/vitals</code> on every page visit
                  via <code className="bg-gray-100 px-1 rounded text-xs">navigator.sendBeacon</code>. Open the Console in another tab,
                  navigate a few pages, then refresh this page — the strip below will populate.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Web Vitals KPI strip */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Web Vitals (p75 over last {win.label})</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {vitals.map(v => {
            const status = vitalStatus(v.name, v.p75)
            const formatted = v.p75 === null ? '—' : VITAL_BUDGETS[v.name].format(v.p75)
            return (
              <KpiTile
                key={v.name}
                label={v.name}
                value={formatted}
                sublabel={v.count > 0 ? `${v.count} samples` : 'No samples'}
                icon={
                  status === 'healthy' ? <CheckCircleIcon className="h-5 w-5" /> :
                  status === 'degraded' ? <ExclamationTriangleIcon className="h-5 w-5" /> :
                  status === 'down' ? <ExclamationTriangleIcon className="h-5 w-5" /> :
                  <BoltIcon className="h-5 w-5" />
                }
              />
            )
          })}
        </div>
      </section>

      {/* Server route timings */}
      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top 10 Slowest Routes</CardTitle>
                <CardDescription>Median + p95 server timing in the last {win.label}. Sorted by p95.</CardDescription>
              </div>
              <ClockIcon className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardBody>
            {routes.length === 0 ? (
              <EmptyState
                title="No server timings recorded"
                description="Server route timings populate when instrumentation calls recordRoute() from server actions or middleware. Web Vitals (above) work without that wiring."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                      <th className="pb-2 font-semibold">Route</th>
                      <th className="pb-2 font-semibold tabular-nums">Median</th>
                      <th className="pb-2 font-semibold tabular-nums">p95</th>
                      <th className="pb-2 font-semibold tabular-nums">Samples</th>
                      <th className="pb-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map(r => {
                      const status: 'healthy' | 'degraded' | 'down' =
                        (r.p95 ?? 0) > 2000 ? 'down' :
                        (r.p95 ?? 0) > 1000 ? 'degraded' : 'healthy'
                      return (
                        <tr key={r.route} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5 font-mono text-xs text-gray-700">{r.route}</td>
                          <td className="py-2.5 tabular-nums text-gray-900">{r.median !== null ? `${Math.round(r.median)}ms` : '—'}</td>
                          <td className="py-2.5 tabular-nums text-gray-500">{r.p95 !== null ? `${Math.round(r.p95)}ms` : '—'}</td>
                          <td className="py-2.5 tabular-nums text-gray-500">{r.count}</td>
                          <td className="py-2.5"><StatusPill status={status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Failed actions + bundle */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Failed Routes (5xx)</CardTitle>
                <CardDescription>Routes returning server errors — derived from recordRoute samples.</CardDescription>
              </div>
              <CursorArrowRaysIcon className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardBody>
            {failed.length === 0 ? (
              <EmptyState
                icon={<CheckCircleIcon className="h-5 w-5" />}
                title="No failures recorded"
                description="When a route emits a 5xx response, it appears here with count and last-seen time."
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {failed.map(a => (
                  <li key={a.route} className="py-2 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-700 truncate">{a.route}</div>
                      <div className="text-[11px] text-gray-500">last {new Date(a.lastAt).toLocaleString()}</div>
                    </div>
                    <Badge tone="red">{a.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bundle Budget</CardTitle>
                <CardDescription>Run <code className="text-xs bg-gray-100 px-1 rounded">ANALYZE=true pnpm --filter @nzila/console build</code> to refresh.</CardDescription>
              </div>
              <ChartBarSquareIcon className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-gray-700">Initial JS (target)</span>
                <span className="tabular-nums text-gray-900">≤ 250 KB gz</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-700">Vendor chunk (target)</span>
                <span className="tabular-nums text-gray-900">≤ 180 KB gz</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-700">Largest route chunk</span>
                <span className="tabular-nums text-gray-900">≤ 90 KB gz</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Budgets are enforced via <code className="bg-gray-100 px-1 rounded">@next/bundle-analyzer</code> when ANALYZE=true. CI fails on regression.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
