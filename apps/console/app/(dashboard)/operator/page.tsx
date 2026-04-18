import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { automationCommands, commerceQuotes, pilotAlerts, pilotDefinitions, pilotHealthScores } from '@nzila/db/schema'
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm'
import { CheckCircleIcon, ExclamationTriangleIcon, PhoneIcon, DocumentTextIcon, CpuChipIcon, ShieldCheckIcon, RocketLaunchIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

const portfolioTiers = [
  { tier: 'TIER 1', label: 'Flagship Revenue', apps: ['union-eyes', 'flow'], action: 'DOUBLE DOWN', color: 'green' },
  { tier: 'TIER 2', label: 'Strategic Growth', apps: ['cfo', 'partners', 'zonga'], action: 'MAINTAIN', color: 'blue' },
  { tier: 'TIER 3', label: 'Internal Platform', apps: ['console', 'control-plane', 'orchestrator-api', 'web'], action: 'INTERNAL ONLY', color: 'gray' },
  { tier: 'TIER 4', label: 'Incubation', apps: ['agrimo', 'cora', 'trade', 'nacp-exams', 'mobility', 'abr'], action: 'HOLD', color: 'yellow' },
  { tier: 'TIER 5', label: 'Frozen', apps: ['platform-admin', 'mobility-client-portal'], action: 'CUT', color: 'red' },
]

const releaseReadinessChecklist = [
  { item: 'All TIER 1 typechecks passing', source: 'pnpm --filter @nzila/union-eyes typecheck && pnpm --filter @nzila/flow typecheck' },
  { item: 'Orchestrator-api unit tests 24/24', source: 'pnpm --filter @nzila/orchestrator-api test' },
  { item: 'Pilot contract governance gates resolved', source: 'governance/pilot-contracts/' },
  { item: 'Product catalog scores reviewed against scorecard', source: 'governance/portfolio/product-catalog.json' },
  { item: 'Truth manifest version up to date', source: 'nzila-truth-manifest.json' },
  { item: 'Evidence sealing pipeline active for union-eyes', source: 'apps/union-eyes/lib/orchestrator-dispatch.ts' },
  { item: 'SLA escalation hooks verified for active pilots', source: 'apps/union-eyes/lib/orchestrator-dispatch.ts' },
  { item: 'Buyer packs current for TIER 1 products', source: 'docs/buyers/' },
]

const weeklyChecklist = [
  'Review Autopilot approvals and convert remaining top recommendation to action.',
  'Run collections triage and update overdue receivables owner assignments.',
  'Reconcile venture priority ranking with current founder calendar allocation.',
  'Close or re-scope stale initiatives older than 14 days.',
  'Publish board-ready summary sentence for Friday update.',
]

const monthlyChecklist = [
  'Refresh runway assumptions and validate burn sensitivity.',
  'Run operating model truth audit: pipeline, execution, obligations, governance.',
  'Score decision quality from past month and recalibrate confidence discipline.',
  'Review org-level compliance evidence and unresolved risk flags.',
]

const escalationMap = [
  { trigger: 'Runway < 4 months', owner: 'Founder + CFO', action: 'Immediate expense controls and collection acceleration.' },
  { trigger: 'P0 decision overdue > 7 days', owner: 'COO', action: 'Escalate in daily standup and assign hard deadline.' },
  { trigger: 'Data freshness score < 60%', owner: 'Ops Lead', action: 'Restore adapter syncs and audit source timestamp gaps.' },
  { trigger: 'Founder overload > 70%', owner: 'Founder', action: 'Cut low-leverage meetings and enforce deep-work blocks.' },
]

const sourceOfTruth = [
  { area: 'Runway + Capital', source: 'apps/console/lib/finance-spine.ts' },
  { area: 'Executive signals', source: 'apps/console/lib/executive-intelligence.ts' },
  { area: 'Autopilot logic', source: 'apps/console/lib/autopilot-engine.ts' },
  { area: 'Forecast logic', source: 'apps/console/lib/forecast-engine.ts' },
  { area: 'Decision learning', source: 'packages/db/src/schema/executive.ts + decision_scorebacks' },
]

interface OpsSnapshot {
  activePilots: number
  pilotsEndingIn30d: number
  openIncidents: number
  openSlaBreaches: number
  churnRiskPilots: number
  failedWorkflows24h: number
  evidenceSealRuns7d: number
  pipelineOpenQuotes: number
  pipelineSentQuotes: number
}

async function loadOpsSnapshot(): Promise<OpsSnapshot> {
  const now = new Date()
  const in30Days = new Date(now)
  in30Days.setDate(in30Days.getDate() + 30)
  const last24h = new Date(now)
  last24h.setHours(last24h.getHours() - 24)
  const last7d = new Date(now)
  last7d.setDate(last7d.getDate() - 7)

  try {
    const [
      activePilotsRes,
      pilotsEndingRes,
      openIncidentsRes,
      openSlaRes,
      churnRiskRes,
      failedFlowsRes,
      evidenceSealRes,
      quoteDraftRes,
      quoteSentRes,
    ] = await Promise.all([
      platformDb.select({ cnt: count() }).from(pilotDefinitions).where(eq(pilotDefinitions.status, 'active')),
      platformDb
        .select({ cnt: count() })
        .from(pilotDefinitions)
        .where(
          and(
            eq(pilotDefinitions.status, 'active'),
            gte(pilotDefinitions.targetEndAt, now),
            sql`${pilotDefinitions.targetEndAt} <= ${in30Days}`,
          ),
        ),
      platformDb
        .select({ cnt: count() })
        .from(pilotAlerts)
        .where(and(isNull(pilotAlerts.resolvedAt), sql`${pilotAlerts.severity} in ('critical', 'high')`)),
      platformDb
        .select({ cnt: count() })
        .from(pilotAlerts)
        .where(and(isNull(pilotAlerts.resolvedAt), sql`${pilotAlerts.alertType} ilike '%sla%'`)),
      platformDb
        .select({ cnt: count() })
        .from(pilotHealthScores)
        .where(sql`${pilotHealthScores.riskLevel} in ('high', 'critical')`),
      platformDb
        .select({ cnt: count() })
        .from(automationCommands)
        .where(and(eq(automationCommands.status, 'failed'), gte(automationCommands.updatedAt, last24h))),
      platformDb
        .select({ cnt: count() })
        .from(automationCommands)
        .where(
          and(
            eq(automationCommands.playbook, 'evidence_seal'),
            eq(automationCommands.status, 'succeeded'),
            gte(automationCommands.updatedAt, last7d),
          ),
        ),
      platformDb.select({ cnt: count() }).from(commerceQuotes).where(eq(commerceQuotes.status, 'draft')),
      platformDb.select({ cnt: count() }).from(commerceQuotes).where(eq(commerceQuotes.status, 'sent')),
    ])

    return {
      activePilots: Number(activePilotsRes[0]?.cnt ?? 0),
      pilotsEndingIn30d: Number(pilotsEndingRes[0]?.cnt ?? 0),
      openIncidents: Number(openIncidentsRes[0]?.cnt ?? 0),
      openSlaBreaches: Number(openSlaRes[0]?.cnt ?? 0),
      churnRiskPilots: Number(churnRiskRes[0]?.cnt ?? 0),
      failedWorkflows24h: Number(failedFlowsRes[0]?.cnt ?? 0),
      evidenceSealRuns7d: Number(evidenceSealRes[0]?.cnt ?? 0),
      pipelineOpenQuotes: Number(quoteDraftRes[0]?.cnt ?? 0),
      pipelineSentQuotes: Number(quoteSentRes[0]?.cnt ?? 0),
    }
  } catch {
    return {
      activePilots: 0,
      pilotsEndingIn30d: 0,
      openIncidents: 0,
      openSlaBreaches: 0,
      churnRiskPilots: 0,
      failedWorkflows24h: 0,
      evidenceSealRuns7d: 0,
      pipelineOpenQuotes: 0,
      pipelineSentQuotes: 0,
    }
  }
}

export default async function OperatorPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const ops = await loadOpsSnapshot()

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Operator Mode</h1>
        <p className="text-sm text-gray-500 mt-1">Transferable operating rhythm for weekly and monthly execution continuity.</p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-blue-700" />
            <h2 className="font-semibold text-blue-900">Orchestrator Operations Console</h2>
          </div>
          <Link
            href="/operator/orchestrator"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Console
          </Link>
        </div>
        <p className="mt-2 text-sm text-blue-900">
          Live queue depth, failed/dead-letter runs, stuck-run detection, execution timelines, and retry/cancel controls.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Enterprise Operations Boards</h2>
          <span className="ml-auto text-xs text-gray-400">schema-backed snapshot</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Release readiness board</p>
            <p className="font-semibold text-gray-800">{ops.failedWorkflows24h} failed workflows (24h)</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Customer health board</p>
            <p className="font-semibold text-gray-800">{ops.churnRiskPilots} pilots at high/critical risk</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Incident board</p>
            <p className="font-semibold text-gray-800">{ops.openIncidents} open high-severity alerts</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Renewals and pipeline board</p>
            <p className="font-semibold text-gray-800">{ops.pilotsEndingIn30d} active pilots ending in 30 days</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Pilot deployment tracker</p>
            <p className="font-semibold text-gray-800">{ops.activePilots} active pilots in execution</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">SLA tracker</p>
            <p className="font-semibold text-gray-800">{ops.openSlaBreaches} unresolved SLA alerts</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Evidence pack generator</p>
            <p className="font-semibold text-gray-800">{ops.evidenceSealRuns7d} evidence seal runs (7d)</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Integration health board</p>
            <p className="font-semibold text-gray-800">Uses provider SLA pages + alerts registry</p>
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-3">
            <p className="text-xs text-gray-500">Revenue analytics layer</p>
            <p className="font-semibold text-gray-800">{ops.pipelineOpenQuotes} draft + {ops.pipelineSentQuotes} sent quotes</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircleIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Weekly Checklist</h2>
          </div>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
            {weeklyChecklist.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Monthly Checklist</h2>
          </div>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
            {monthlyChecklist.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <PhoneIcon className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Escalation Map</h2>
        </div>
        <div className="space-y-3 text-sm">
          {escalationMap.map((row) => (
            <div key={row.trigger} className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="font-medium text-gray-900">{row.trigger}</p>
              <p className="text-gray-600">Owner: {row.owner}</p>
              <p className="text-gray-600">{row.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-700" />
          <h2 className="font-semibold text-amber-900">Source-of-Truth Locations</h2>
        </div>
        <div className="space-y-2 text-sm text-amber-900">
          {sourceOfTruth.map((item) => (
            <p key={item.area}><span className="font-semibold">{item.area}:</span> {item.source}</p>
          ))}
        </div>
      </div>

        {/* Portfolio Tier Overview */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Portfolio Tier Model</h2>
            <span className="ml-auto text-xs text-gray-400">v2026-04-17 · 17 apps · 5 tiers</span>
          </div>
          <div className="space-y-2">
            {portfolioTiers.map((row) => (
              <div key={row.tier} className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                <span className="font-mono font-bold text-gray-700 w-14 shrink-0">{row.tier}</span>
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{row.label}</span>
                  <span className="ml-2 text-gray-500">{row.apps.join(', ')}</span>
                </div>
                <span className="text-xs font-semibold text-gray-500 shrink-0">{row.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Release Readiness Gate */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <RocketLaunchIcon className="h-5 w-5 text-green-700" />
            <h2 className="font-semibold text-green-900">Release Readiness Gate</h2>
          </div>
          <div className="space-y-2 text-sm text-green-900">
            {releaseReadinessChecklist.map((row) => (
              <div key={row.item} className="flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                <div>
                  <span className="font-medium">{row.item}</span>
                  <span className="ml-2 font-mono text-xs text-green-700">{row.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Security & Governance */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Platform Security & Governance</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Auth model', value: '@nzila/platform-auth (Argon2id + Entra SSO)' },
              { label: 'Audit system', value: 'Hash-chained evidence bundles (proof-center)' },
              { label: 'Secrets', value: 'Azure Key Vault (nzila-staging-kv)' },
              { label: 'Orchestrator idempotency', value: 'DB-native OCC + lease guards' },
              { label: 'Dependency audit', value: 'tooling/security/supply-chain-policy.ts' },
              { label: 'Vulnerability disclosure', value: 'docs/governance/vulnerability-disclosure-policy.md' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-medium text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
    </div>
  )
}
