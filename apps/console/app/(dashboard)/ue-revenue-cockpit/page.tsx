/**
 * Nzila OS Console — Union Eyes Founder Revenue Cockpit
 *
 * Founder-grade sales command centre for the Union Eyes outbound pipeline.
 *
 * Panels:
 *   - Pipeline Health  : targets loaded, Tier A active, no-next-step, at-risk
 *   - Deal Funnel      : stage-by-stage counts for all UE deals
 *   - Value            : weighted pipeline $, pilots in flight, projected ARR
 *   - Focus            : next 5 must-contact, deals at risk, overdue follow-ups
 *   - Execution        : today's 3 revenue actions, this week's win condition
 *   - Activity         : sequence instances — null state handled if no data
 *
 * Hard rules:
 *   - No fake data: every metric traceable to a real store record or seed
 *   - Null states shown cleanly — "Awaiting activity data" where empty
 *   - No duplicate logic from ue-pipeline/page.tsx — this is the founder view
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  icp,
  unionMap,
  sequences,
  type TargetOrganisation,
} from '@nzila/platform-growth-os'
import { seedDeals } from '@nzila/deal-engine/seed'
import type { Deal } from '@nzila/deal-engine'
import {
  RocketLaunchIcon,
  FunnelIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Stage probability weights for weighted pipeline $ ────────────────────────
const STAGE_PROBABILITY: Record<string, number> = {
  lead: 0.05,
  qualified: 0.20,
  demo_scheduled: 0.35,
  demo_completed: 0.50,
  pilot_proposed: 0.65,
  pilot_active: 0.80,
  data_received: 0.85,
  ingestion_running: 0.90,
  pilot_review: 0.90,
  converted: 1.0,
  dormant: 0,
  lost: 0,
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CockpitData {
  // Pipeline health
  totalTargets: number
  tierACount: number
  tierBCount: number
  untouchedTierA: number   // Tier A targets with no deal
  activeDealsCount: number
  staleDealsCount: number  // daysInStage > 14 and not converted/lost
  // Deals by stage
  allUEDeals: Deal[]
  leadCount: number
  qualifiedCount: number
  demoScheduledCount: number
  demoCompletedCount: number
  proposedCount: number
  pilotActiveCount: number
  convertedCount: number
  dormantCount: number
  // Value
  weightedPipelineCAD: number
  pilotsInFlight: number
  convertedValueCAD: number
  // Focus panel
  mustContactTargets: TargetOrganisation[]
  dealsAtRisk: Deal[]
  overdueFollowUps: Deal[]
  // Activity (from sequences)
  activeSequences: number
  completedSequences: number
  // Execution
  todayActions: { label: string; urgency: 'critical' | 'high' | 'normal' }[]
  winCondition: string
}

// ── Loader ─────────────────────────────────────────────────────────────────────

async function loadCockpitData(): Promise<CockpitData> {
  // ── ICP targets ────────────────────────────────────────────────────────────
  icp.bootstrapIcpSegments()
  const targets = icp.rankedTargetOrgs()
  const tierATargets = targets.filter((t) => t.icpScore?.tier === 'A')
  const tierBTargets = targets.filter((t) => t.icpScore?.tier === 'B')

  // ── Deals — UE only ────────────────────────────────────────────────────────
  const allUEDeals = seedDeals.filter((d) => d.product === 'union-eyes')
  const activeUEDeals = allUEDeals.filter(
    (d) => !['lost', 'dormant', 'converted'].includes(d.stage),
  )
  const staleDeals = activeUEDeals.filter((d) => (d.daysInStage ?? 0) > 14)

  // ── Pipeline Health ─────────────────────────────────────────────────────────
  // "Untouched" Tier A = Tier A ICP targets with no dealEngineId
  const activeAccountIds = new Set(allUEDeals.map((d) => d.accountId))
  const untouchedTierA = targets.filter(
    (t) => t.icpScore?.tier === 'A' && !activeAccountIds.has(t.dealEngineId ?? ''),
  ).length

  // ── Stage counts ─────────────────────────────────────────────────────────────
  const countStage = (stage: string) => allUEDeals.filter((d) => d.stage === stage).length

  // ── Weighted pipeline ─────────────────────────────────────────────────────
  const weightedPipelineCAD = allUEDeals.reduce((sum, d) => {
    const prob = STAGE_PROBABILITY[d.stage] ?? 0
    return sum + (d.estimatedValue ?? 0) * prob
  }, 0)
  const pilotsInFlight = allUEDeals.filter((d) =>
    ['pilot_active', 'data_received', 'ingestion_running', 'pilot_review'].includes(d.stage),
  ).length
  const convertedValueCAD = allUEDeals
    .filter((d) => d.stage === 'converted')
    .reduce((sum, d) => sum + (d.estimatedValue ?? 0), 0)

  // ── Focus: next 5 must-contact ─────────────────────────────────────────────
  // Top Tier A targets not yet in any deal
  const mustContactTargets = targets
    .filter((t) => t.icpScore?.tier === 'A' && !t.dealEngineId)
    .slice(0, 5)

  // ── Focus: deals at risk ────────────────────────────────────────────────────
  const dealsAtRisk = allUEDeals.filter(
    (d) =>
      d.conversionRisk === 'high' ||
      ((d.daysInStage ?? 0) > 21 && !['converted', 'lost', 'dormant'].includes(d.stage)),
  )

  // ── Focus: overdue follow-ups ───────────────────────────────────────────────
  const overdueFollowUps = staleDeals.filter((d) => d.conversionRisk !== 'low')

  // ── Sequences (activity) ───────────────────────────────────────────────────
  sequences.bootstrapSequences()
  const allInstances = sequences.listSequenceInstances()
  const activeSequences = allInstances.filter((i) => i.status === 'active').length
  const completedSequences = allInstances.filter((i) => i.status === 'completed').length

  // ── Execution: today's 3 actions ─────────────────────────────────────────
  const todayActions: CockpitData['todayActions'] = []

  // Find the most advanced non-converted deal needing action
  const demoCompleted = allUEDeals.find((d) => d.stage === 'demo_completed')
  if (demoCompleted) {
    todayActions.push({
      label: `Send pilot proposal → ${demoCompleted.accountName}`,
      urgency: 'critical',
    })
  }

  // Any stale qualified/demo_scheduled deal
  const staleQualified = staleDeals.find((d) =>
    ['qualified', 'demo_scheduled'].includes(d.stage),
  )
  if (staleQualified) {
    todayActions.push({
      label: `Re-engage stale deal → ${staleQualified.accountName} (${staleQualified.daysInStage}d in stage)`,
      urgency: 'high',
    })
  }

  // Top untouched Tier A target (if targets are loaded)
  if (mustContactTargets.length > 0) {
    todayActions.push({
      label: `Send first-touch email → ${mustContactTargets[0]?.name ?? 'top Tier A target'}`,
      urgency: 'normal',
    })
  } else {
    // Fallback to top cold deal
    const leadDeal = allUEDeals.find((d) => d.stage === 'lead')
    if (leadDeal) {
      todayActions.push({
        label: `Qualify lead → ${leadDeal.accountName}`,
        urgency: 'normal',
      })
    }
  }

  // Ensure we always have 3 actions
  if (todayActions.length < 3) {
    todayActions.push({
      label: 'Send top-15 first-touch outreach — see docs/commercial/outreach/TOP_15_FIRST_TOUCH_EMAILS.md',
      urgency: 'normal',
    })
  }
  todayActions.splice(3)

  // ── Win condition ─────────────────────────────────────────────────────────
  const winCondition = demoCompleted
    ? `Close ${demoCompleted.accountName} pilot proposal this week — $${(demoCompleted.estimatedValue ?? 0).toLocaleString('en-CA')} CAD`
    : pilotsInFlight > 0
    ? `Advance ${pilotsInFlight} pilot${pilotsInFlight > 1 ? 's' : ''} to conversion this week`
    : activeUEDeals.length > 0
    ? `Move ${activeUEDeals[0]?.accountName ?? 'top deal'} to next stage this week`
    : 'Send 5 first-touch emails this week to Tier A targets'

  // ── Bootstrap union map for stats ─────────────────────────────────────────
  unionMap.bootstrapUnionMap()

  return {
    totalTargets: targets.length,
    tierACount: tierATargets.length,
    tierBCount: tierBTargets.length,
    untouchedTierA,
    activeDealsCount: activeUEDeals.length,
    staleDealsCount: staleDeals.length,
    allUEDeals,
    leadCount: countStage('lead'),
    qualifiedCount: countStage('qualified'),
    demoScheduledCount: countStage('demo_scheduled'),
    demoCompletedCount: countStage('demo_completed'),
    proposedCount: countStage('pilot_proposed'),
    pilotActiveCount: pilotsInFlight,
    convertedCount: countStage('converted'),
    dormantCount: countStage('dormant'),
    weightedPipelineCAD,
    pilotsInFlight,
    convertedValueCAD,
    mustContactTargets,
    dealsAtRisk,
    overdueFollowUps,
    activeSequences,
    completedSequences,
    todayActions,
    winCondition,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCAD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiTile({
  icon,
  label,
  value,
  sub,
  accent = 'indigo',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'amber' | 'red' | 'indigo' | 'gray'
}) {
  const accentBg = {
    green: 'bg-green-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
    indigo: 'bg-indigo-50',
    gray: 'bg-gray-50',
  }[accent]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-lg ${accentBg} p-2.5`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function FunnelBar({
  stage,
  count,
  total,
  accent,
}: {
  stage: string
  count: number
  total: number
  accent: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-xs text-gray-600 capitalize">
        {stage.replace(/_/g, ' ')}
      </div>
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full ${accent}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-6 text-xs font-semibold text-gray-700 text-right">{count}</div>
    </div>
  )
}

function ActionRow({
  item,
}: {
  item: { label: string; urgency: 'critical' | 'high' | 'normal' }
}) {
  const badge = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-amber-100 text-amber-700',
    normal: 'bg-gray-100 text-gray-600',
  }[item.urgency]
  const label = {
    critical: 'DO NOW',
    high: 'TODAY',
    normal: 'THIS WEEK',
  }[item.urgency]
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${badge}`}>
        {label}
      </span>
      <span className="text-sm text-gray-800">{item.label}</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function UERevenueCockpitPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const d = await loadCockpitData()

  const totalDeals = d.allUEDeals.length
  const hasTargets = d.totalTargets > 0
  const hasActivityData = d.activeSequences > 0 || d.completedSequences > 0

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6 pb-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RocketLaunchIcon className="h-6 w-6 text-indigo-600" />
            Union Eyes Revenue Cockpit
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Founder pipeline command centre — pipeline health, value, focus, and today&apos;s actions.
          </p>
        </div>
        <Link
          href="/ue-pipeline"
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          Full pipeline view <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Win Condition ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gray-900 text-white px-6 py-4">
        <p className="text-xs uppercase tracking-widest text-gray-400">This Week&apos;s Win Condition</p>
        <p className="mt-2 text-lg font-semibold leading-snug">{d.winCondition}</p>
      </div>

      {/* ── Pipeline Health ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pipeline Health
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile
            icon={<UsersIcon className="h-5 w-5 text-indigo-600" />}
            label="Targets Loaded"
            value={hasTargets ? d.totalTargets : '—'}
            sub={hasTargets ? `${d.tierACount} Tier A · ${d.tierBCount} Tier B` : 'Awaiting ICP seeding'}
            accent="indigo"
          />
          <KpiTile
            icon={<ChartBarIcon className="h-5 w-5 text-green-600" />}
            label="Active Deals"
            value={d.activeDealsCount}
            sub={`${d.allUEDeals.length} total UE deals`}
            accent="green"
          />
          <KpiTile
            icon={<ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />}
            label="Untouched Tier A"
            value={hasTargets ? d.untouchedTierA : '—'}
            sub={hasTargets ? 'High-priority, no deal yet' : 'Awaiting target seeding'}
            accent="amber"
          />
          <KpiTile
            icon={<ClockIcon className="h-5 w-5 text-red-500" />}
            label="Stale Deals"
            value={d.staleDealsCount}
            sub=">14 days in current stage"
            accent={d.staleDealsCount > 0 ? 'red' : 'gray'}
          />
        </div>
      </section>

      {/* ── Value ───────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pipeline Value
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiTile
            icon={<CurrencyDollarIcon className="h-5 w-5 text-green-600" />}
            label="Weighted Pipeline"
            value={fmtCAD(d.weightedPipelineCAD)}
            sub="Stage-probability weighted (CAD)"
            accent="green"
          />
          <KpiTile
            icon={<RocketLaunchIcon className="h-5 w-5 text-indigo-600" />}
            label="Pilots In Flight"
            value={d.pilotsInFlight}
            sub="Active · ingestion · review"
            accent="indigo"
          />
          <KpiTile
            icon={<CheckCircleIcon className="h-5 w-5 text-green-600" />}
            label="Converted ARR"
            value={d.convertedValueCAD > 0 ? fmtCAD(d.convertedValueCAD) : '—'}
            sub={d.convertedValueCAD > 0 ? 'Total converted deal value' : 'Awaiting first conversion'}
            accent={d.convertedValueCAD > 0 ? 'green' : 'gray'}
          />
        </div>
      </section>

      {/* ── Deal Funnel + Focus (side by side on large screens) ─────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Deal Funnel — Union Eyes</h2>
          </div>
          {totalDeals === 0 ? (
            <p className="text-sm text-gray-400 italic">Awaiting deal data</p>
          ) : (
            <div className="space-y-2">
              <FunnelBar stage="Lead" count={d.leadCount} total={totalDeals} accent="bg-gray-400" />
              <FunnelBar stage="Qualified" count={d.qualifiedCount} total={totalDeals} accent="bg-blue-400" />
              <FunnelBar stage="Demo scheduled" count={d.demoScheduledCount} total={totalDeals} accent="bg-indigo-400" />
              <FunnelBar stage="Demo completed" count={d.demoCompletedCount} total={totalDeals} accent="bg-violet-500" />
              <FunnelBar stage="Pilot proposed" count={d.proposedCount} total={totalDeals} accent="bg-purple-500" />
              <FunnelBar stage="Pilot active" count={d.pilotActiveCount} total={totalDeals} accent="bg-emerald-500" />
              <FunnelBar stage="Converted" count={d.convertedCount} total={totalDeals} accent="bg-green-600" />
              {d.dormantCount > 0 && (
                <FunnelBar stage="Dormant" count={d.dormantCount} total={totalDeals} accent="bg-gray-300" />
              )}
            </div>
          )}
        </div>

        {/* Focus */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Focus Panel</h2>

          {/* Deals at risk */}
          <div>
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
              Deals at Risk
            </p>
            {d.dealsAtRisk.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No at-risk deals</p>
            ) : (
              <div className="space-y-1">
                {d.dealsAtRisk.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between rounded bg-red-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-gray-800">{deal.accountName}</span>
                    <span className="text-red-600 capitalize">{deal.stage.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue follow-ups */}
          <div>
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">
              Overdue Follow-ups
            </p>
            {d.overdueFollowUps.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No overdue follow-ups</p>
            ) : (
              <div className="space-y-1">
                {d.overdueFollowUps.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between rounded bg-amber-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-gray-800">{deal.accountName}</span>
                    <span className="text-amber-700">{deal.daysInStage}d in stage</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Must-contact targets */}
          <div>
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
              Next 5 Must-Contact (Tier A)
            </p>
            {d.mustContactTargets.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                {hasTargets ? 'All Tier A targets in pipeline' : 'Awaiting target seeding'}
              </p>
            ) : (
              <div className="space-y-1">
                {d.mustContactTargets.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded bg-indigo-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-gray-800">{t.name}</span>
                    <span className="text-indigo-600">
                      {t.icpScore ? `Score ${t.icpScore.total.toFixed(2)}` : 'Unscored'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Today's 3 Revenue Actions ────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <BoltIcon className="h-4 w-4" />
          Today&apos;s Revenue Actions
        </h2>
        <div className="space-y-2">
          {d.todayActions.map((action, i) => (
            <ActionRow key={`action-${i}`} item={action} />
          ))}
        </div>
      </section>

      {/* ── Activity (sequence data) ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Outreach Activity
        </h2>
        {!hasActivityData ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-gray-500">Awaiting activity data</p>
            <p className="text-xs text-gray-400 mt-1">
              Sequence activity will appear here once outreach is logged.
              See{' '}
              <Link href="/ue-pipeline" className="text-indigo-500 hover:underline">
                pipeline view
              </Link>{' '}
              to start sequences.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <KpiTile
              icon={<BoltIcon className="h-5 w-5 text-indigo-600" />}
              label="Active Sequences"
              value={d.activeSequences}
              accent="indigo"
            />
            <KpiTile
              icon={<CheckCircleIcon className="h-5 w-5 text-green-600" />}
              label="Completed Sequences"
              value={d.completedSequences}
              accent="green"
            />
          </div>
        )}
      </section>

      {/* ── Outreach Resources ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Outreach Resources</h2>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <a
            href="#"
            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-indigo-700 hover:bg-indigo-50"
          >
            <ArrowRightIcon className="h-3 w-3" />
            Top 15 First-Touch Emails →
            <span className="text-xs text-gray-400 ml-auto">docs/commercial/outreach/</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-indigo-700 hover:bg-indigo-50"
          >
            <ArrowRightIcon className="h-3 w-3" />
            Meeting Booker Pack →
            <span className="text-xs text-gray-400 ml-auto">docs/commercial/outreach/</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-indigo-700 hover:bg-indigo-50"
          >
            <ArrowRightIcon className="h-3 w-3" />
            Top 15 Pursuit List →
            <span className="text-xs text-gray-400 ml-auto">docs/commercial/</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-indigo-700 hover:bg-indigo-50"
          >
            <ArrowRightIcon className="h-3 w-3" />
            Enterprise Close Sequence →
            <span className="text-xs text-gray-400 ml-auto">docs/commercial/close-package/</span>
          </a>
        </div>
      </section>

    </div>
  )
}
