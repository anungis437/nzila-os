/**
 * Nzila OS Console — Union Eyes Pilot Pipeline
 *
 * Outbound command centre: tracks UE prospects from ICP targeting →
 * outreach → demo → pilot → conversion → land-and-expand.
 *
 * Hard rules:
 *   - No empty widgets: every section hidden if data is absent
 *   - All pipeline stages from @nzila/deal-engine (no local stage enum)
 *   - Data: deal-engine seed, GrowthOS icp/unionMap/sequences modules
 *   - No fake metrics — every number traceable to a real record
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  icp,
  unionMap,
  sequences,
  type TargetOrganisation,
  type SequenceInstance,
} from '@nzila/platform-growth-os'
import { seedDeals } from '@nzila/deal-engine/seed'
import type { Deal } from '@nzila/deal-engine'
import {
  UsersIcon,
  ChartBarIcon,
  MegaphoneIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  MapIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UEPipelineData {
  // ICP
  targets: TargetOrganisation[]
  tierACounts: number
  tierBCounts: number
  // Sequences
  activeInstances: SequenceInstance[]
  completedInstances: SequenceInstance[]
  // Deals (union-eyes only)
  allUEDeals: Deal[]
  leadDeals: Deal[]
  qualifiedDeals: Deal[]
  demoScheduled: Deal[]
  demoCompleted: Deal[]
  proposedDeals: Deal[]
  pilotActiveDeals: Deal[]
  convertedDeals: Deal[]
  dormantDeals: Deal[]
  // Pipeline value
  pipelineValueCAD: number
  avgDealValueCAD: number
  convertedValueCAD: number
  // Expansion
  expansionTargets: Awaited<ReturnType<typeof unionMap.getExpansionTargets>>
  // Map stats
  mapStats: Awaited<ReturnType<typeof unionMap.getMapStats>>
}

// ── Loader ─────────────────────────────────────────────────────────────────────

async function loadUEPipelineData(): Promise<UEPipelineData> {
  // ICP targets — bootstrap first run
  icp.bootstrapIcpSegments()
  const targets = icp.rankedTargetOrgs()
  const tierACounts = targets.filter((t) => t.icpScore?.tier === 'A').length
  const tierBCounts = targets.filter((t) => t.icpScore?.tier === 'B').length

  // Sequences — bootstrap first run
  sequences.bootstrapSequences()
  const allInstances = sequences.listSequenceInstances()
  const activeInstances = allInstances.filter((i) => i.status === 'active')
  const completedInstances = allInstances.filter((i) => i.status === 'completed')

  // Deals — use seed data filtered to union-eyes (in prod: swap for adapter-backed query)
  const allUEDeals = seedDeals.filter((d) => d.product === 'union-eyes')
  const leadDeals = allUEDeals.filter((d) => d.stage === 'lead')
  const qualifiedDeals = allUEDeals.filter((d) => d.stage === 'qualified')
  const demoScheduled = allUEDeals.filter((d) => d.stage === 'demo_scheduled')
  const demoCompleted = allUEDeals.filter((d) => d.stage === 'demo_completed')
  const proposedDeals = allUEDeals.filter((d) => d.stage === 'pilot_proposed')
  const pilotActiveDeals = allUEDeals.filter((d) =>
    ['pilot_active', 'data_received', 'ingestion_running', 'pilot_review'].includes(d.stage)
  )
  const convertedDeals = allUEDeals.filter((d) => d.stage === 'converted')
  const dormantDeals = allUEDeals.filter((d) => d.stage === 'dormant')

  // Values
  const pipelineValueCAD = allUEDeals
    .filter((d) => !['lost', 'dormant'].includes(d.stage))
    .reduce((sum, d) => sum + (d.estimatedValue ?? 0), 0)
  const avgDealValueCAD = allUEDeals.length > 0 ? pipelineValueCAD / allUEDeals.length : 0
  const convertedValueCAD = convertedDeals.reduce((sum, d) => sum + (d.estimatedValue ?? 0), 0)

  // Expansion: find any converted deal with a union node match
  unionMap.bootstrapUnionMap()
  const mapStats = unionMap.getMapStats()
  let expansionTargets: Awaited<ReturnType<typeof unionMap.getExpansionTargets>> = []
  const convertedWithNode = convertedDeals.find((d) => {
    const nodes = unionMap.listUnionNodes()
    return nodes.some((n) => n.dealEngineId === d.id)
  })
  if (convertedWithNode) {
    const nodes = unionMap.listUnionNodes()
    const matchedNode = nodes.find((n) => n.dealEngineId === convertedWithNode.id)
    if (matchedNode) {
      expansionTargets = await unionMap.getExpansionTargets(matchedNode.id, 3)
    }
  }

  return {
    targets, tierACounts, tierBCounts,
    activeInstances, completedInstances,
    allUEDeals, leadDeals, qualifiedDeals,
    demoScheduled, demoCompleted, proposedDeals,
    pilotActiveDeals, convertedDeals, dormantDeals,
    pipelineValueCAD, avgDealValueCAD, convertedValueCAD,
    expansionTargets, mapStats,
  }
}

// ── Components ─────────────────────────────────────────────────────────────────

function SummaryCard({ icon, title, value, subtext, accent }: {
  icon: React.ReactNode
  title: string
  value: string | number
  subtext?: string
  accent?: 'green' | 'amber' | 'red' | 'indigo' | 'gray'
}) {
  const bg = {
    green: 'bg-green-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
    indigo: 'bg-indigo-50',
    gray: 'bg-gray-50',
  }[accent ?? 'indigo']

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-3 p-4">
        <div className={`shrink-0 rounded-lg ${bg} p-3`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
      </div>
    </div>
  )
}

function FunnelRow({ label, count, deals }: { label: string; count: number; deals: Deal[] }) {
  if (count === 0) return null
  const highRisk = deals.filter((d) => d.conversionRisk === 'high').length
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        {highRisk > 0 && (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {highRisk} at risk
          </span>
        )}
        <span className="text-sm font-bold text-gray-900">{count}</span>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function UEPipelinePage() {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const d = await loadUEPipelineData()

  const totalMidFunnel = d.demoScheduled.length + d.demoCompleted.length + d.proposedDeals.length
  const responseRate = d.activeInstances.length + d.completedInstances.length > 0
    ? Math.round((d.completedInstances.length / (d.activeInstances.length + d.completedInstances.length)) * 100)
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Union Eyes — Pilot Pipeline</h1>
          <p className="text-sm text-gray-500">
            Outbound command centre: ICP targets → outreach → demo → signed pilot
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ue-pipeline/targets"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            View Targets
          </Link>
          <Link
            href="/ue-pipeline/sequences"
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Sequences
          </Link>
        </div>
      </div>

      {/* Top-of-funnel */}
      {(d.targets.length > 0 || d.activeInstances.length > 0) && (
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-indigo-500" />
            Top of Funnel — Targeting &amp; Outreach
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {d.targets.length > 0 && (
              <SummaryCard
                icon={<MapIcon className="h-5 w-5 text-indigo-500" />}
                title="Targets Identified"
                value={d.targets.length}
                subtext={`${d.tierACounts} Tier A · ${d.tierBCounts} Tier B`}
                accent="indigo"
              />
            )}
            {d.activeInstances.length > 0 && (
              <SummaryCard
                icon={<MegaphoneIcon className="h-5 w-5 text-indigo-500" />}
                title="Active Sequences"
                value={d.activeInstances.length}
                subtext="Contacts in outreach cadence"
                accent="indigo"
              />
            )}
            {responseRate !== null && (
              <SummaryCard
                icon={<ChartBarIcon className="h-5 w-5 text-green-500" />}
                title="Sequence Completion"
                value={`${responseRate}%`}
                subtext={`${d.completedInstances.length} completed`}
                accent="green"
              />
            )}
            {(d.leadDeals.length > 0 || d.qualifiedDeals.length > 0) && (
              <SummaryCard
                icon={<UsersIcon className="h-5 w-5 text-indigo-500" />}
                title="Leads in CRM"
                value={d.leadDeals.length + d.qualifiedDeals.length}
                subtext={`${d.qualifiedDeals.length} qualified`}
                accent="indigo"
              />
            )}
          </div>
        </section>
      )}

      {/* Mid-funnel */}
      {totalMidFunnel > 0 && (
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-900 flex items-center gap-2">
            <RocketLaunchIcon className="h-5 w-5 text-amber-500" />
            Mid-Funnel — Demos &amp; Proposals
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {d.demoScheduled.length > 0 && (
              <SummaryCard
                icon={<RocketLaunchIcon className="h-5 w-5 text-amber-500" />}
                title="Demos Scheduled"
                value={d.demoScheduled.length}
                accent="amber"
              />
            )}
            {d.demoCompleted.length > 0 && (
              <SummaryCard
                icon={<RocketLaunchIcon className="h-5 w-5 text-amber-500" />}
                title="Demos Completed"
                value={d.demoCompleted.length}
                subtext="Awaiting proposal"
                accent="amber"
              />
            )}
            {d.proposedDeals.length > 0 && (
              <SummaryCard
                icon={<CheckCircleIcon className="h-5 w-5 text-amber-500" />}
                title="Proposals Sent"
                value={d.proposedDeals.length}
                subtext="Awaiting pilot sign-off"
                accent="amber"
              />
            )}
          </div>
        </section>
      )}

      {/* Bottom-of-funnel */}
      {(d.pilotActiveDeals.length > 0 || d.convertedDeals.length > 0) && (
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            Bottom of Funnel — Pilots &amp; Conversions
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {d.pilotActiveDeals.length > 0 && (
              <SummaryCard
                icon={<RocketLaunchIcon className="h-5 w-5 text-green-500" />}
                title="Active Pilots"
                value={d.pilotActiveDeals.length}
                subtext="Running or in ingestion"
                accent="green"
              />
            )}
            {d.convertedDeals.length > 0 && (
              <SummaryCard
                icon={<CheckCircleIcon className="h-5 w-5 text-green-500" />}
                title="Converted"
                value={d.convertedDeals.length}
                subtext={`CAD ${(d.convertedValueCAD / 1000).toFixed(0)}k ARR`}
                accent="green"
              />
            )}
            {d.dormantDeals.length > 0 && (
              <SummaryCard
                icon={<ChartBarIcon className="h-5 w-5 text-gray-400" />}
                title="Dormant / At Risk"
                value={d.dormantDeals.length}
                subtext="Re-engagement eligible"
                accent="gray"
              />
            )}
          </div>
        </section>
      )}

      {/* Pipeline value */}
      {d.pipelineValueCAD > 0 && (
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-900 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-indigo-500" />
            Pipeline Value
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<ChartBarIcon className="h-5 w-5 text-indigo-500" />}
              title="Active Pipeline (CAD)"
              value={`$${(d.pipelineValueCAD / 1000).toFixed(0)}k`}
              subtext={`${d.allUEDeals.length} total deals`}
              accent="indigo"
            />
            {d.avgDealValueCAD > 0 && (
              <SummaryCard
                icon={<ChartBarIcon className="h-5 w-5 text-indigo-500" />}
                title="Avg Deal Size (CAD)"
                value={`$${(d.avgDealValueCAD / 1000).toFixed(0)}k`}
                accent="indigo"
              />
            )}
          </div>
        </section>
      )}

      {/* Funnel breakdown */}
      {d.allUEDeals.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Deal Stage Breakdown</h2>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 divide-y divide-gray-100">
            <FunnelRow label="Lead" count={d.leadDeals.length} deals={d.leadDeals} />
            <FunnelRow label="Qualified" count={d.qualifiedDeals.length} deals={d.qualifiedDeals} />
            <FunnelRow label="Demo Scheduled" count={d.demoScheduled.length} deals={d.demoScheduled} />
            <FunnelRow label="Demo Completed" count={d.demoCompleted.length} deals={d.demoCompleted} />
            <FunnelRow label="Pilot Proposed" count={d.proposedDeals.length} deals={d.proposedDeals} />
            <FunnelRow label="Pilot Active / Running" count={d.pilotActiveDeals.length} deals={d.pilotActiveDeals} />
            <FunnelRow label="Converted" count={d.convertedDeals.length} deals={d.convertedDeals} />
            <FunnelRow label="Dormant" count={d.dormantDeals.length} deals={d.dormantDeals} />
          </div>
        </section>
      )}

      {/* Land-and-expand targets */}
      {d.expansionTargets.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900 flex items-center gap-2">
            <ArrowRightIcon className="h-5 w-5 text-indigo-500" />
            Land-and-Expand Targets
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Unions adjacent to converted accounts, ranked by expansion adjacency score.
          </p>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {d.expansionTargets.map((t) => (
              <div key={t.node.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.node.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.node.sector} · {t.node.province ?? 'National'} ·{' '}
                    {t.node.memberCount != null ? `${t.node.memberCount.toLocaleString()} members` : 'members unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {t.relation.relationType.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-bold text-gray-700">
                    {Math.round(t.relation.adjacencyScore * 100)}% adj
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Union map stats */}
      {d.mapStats.totalNodes > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900 flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-gray-500" />
            Union Landscape
          </h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            <SummaryCard
              icon={<UsersIcon className="h-5 w-5 text-gray-500" />}
              title="Mapped Unions"
              value={d.mapStats.totalNodes}
              accent="gray"
            />
            <SummaryCard
              icon={<ChartBarIcon className="h-5 w-5 text-gray-500" />}
              title="Total Members"
              value={`${(d.mapStats.totalMembers / 1_000_000).toFixed(1)}M`}
              accent="gray"
            />
            {d.mapStats.inPipeline > 0 && (
              <SummaryCard
                icon={<RocketLaunchIcon className="h-5 w-5 text-indigo-500" />}
                title="In Pipeline"
                value={d.mapStats.inPipeline}
                accent="indigo"
              />
            )}
            <SummaryCard
              icon={<ArrowRightIcon className="h-5 w-5 text-gray-500" />}
              title="Expansion Paths"
              value={d.mapStats.expansionPaths}
              accent="gray"
            />
          </div>
        </section>
      )}
    </div>
  )
}
