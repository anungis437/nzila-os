import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { Stat } from '@/components/primitives/Stat'
import { fmtCompactCurrency, fmtRelativeDays } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import type { PipelineStage } from '@nzila/hq-domain'

export const dynamic = 'force-dynamic'

const STAGES: PipelineStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'pilot',
  'won',
  'lost',
  'expansion',
]

const STAGE_TONE: Record<PipelineStage, 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'> =
  {
    lead: 'slate',
    qualified: 'sky',
    proposal: 'amber',
    negotiation: 'amber',
    pilot: 'violet',
    won: 'emerald',
    lost: 'rose',
    expansion: 'emerald',
  }

export default async function PipelinePage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:pipeline')

  const repo = getHqRepository()
  const opps = repo.listOpportunities()
  const usersById = new Map(repo.listUsers().map((u) => [u.id, u]))
  const ventures = new Map(repo.listVentures().map((v) => [v.slug, v]))

  const totalValue = opps.reduce((s, o) => s + o.estimatedValueCents, 0)
  const weighted = opps.reduce((s, o) => s + o.estimatedValueCents * o.probability, 0)
  const stale = opps.filter(
    (o) => o.daysStale > 14 && o.stage !== 'won' && o.stage !== 'lost',
  ).length
  const founderTouch = opps.filter((o) => o.founderTouchRequired).length

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 4 · Opportunity Pipeline"
        title="Pipeline"
        description="Every opportunity, every venture. Founder-touch and stale-deal flags are computed by the automation engine — no manual tagging."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total pipeline" value={fmtCompactCurrency(totalValue)} />
        <Stat label="Weighted" value={fmtCompactCurrency(Math.round(weighted))} />
        <Stat label="Stale (>14d)" value={stale} tone={stale > 0 ? 'amber' : 'green'} />
        <Stat
          label="Founder-touch required"
          value={founderTouch}
          tone={founderTouch > 2 ? 'red' : founderTouch > 0 ? 'amber' : 'green'}
        />
      </div>

      {STAGES.map((stage) => {
        const stageOpps = opps.filter((o) => o.stage === stage)
        if (stageOpps.length === 0) return null
        return (
          <Card
            key={stage}
            title={`${stage.charAt(0).toUpperCase() + stage.slice(1)} (${stageOpps.length})`}
            description={`${fmtCompactCurrency(stageOpps.reduce((s, o) => s + o.estimatedValueCents, 0))} unweighted`}
            action={<Badge tone={STAGE_TONE[stage]}>{stage}</Badge>}
          >
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Opportunity</th>
                    <th className="px-4 py-2 text-left">Venture</th>
                    <th className="px-4 py-2 text-left">Owner</th>
                    <th className="px-4 py-2 text-right">Value</th>
                    <th className="px-4 py-2 text-right">Probability</th>
                    <th className="px-4 py-2 text-right">Stale</th>
                    <th className="px-4 py-2 text-left">Next action</th>
                    <th className="px-4 py-2 text-left">Close</th>
                    <th className="px-4 py-2 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {stageOpps.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{o.name}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {ventures.get(o.ventureSlug)?.name ?? o.ventureSlug}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {usersById.get(o.ownerUserId)?.fullName ?? o.ownerUserId}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                        {fmtCompactCurrency(o.estimatedValueCents)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                        {Math.round(o.probability * 100)}%
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                        {o.daysStale}d
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">{o.nextAction}</td>
                      <td className="px-4 py-2 text-xs text-slate-700">
                        {fmtRelativeDays(o.expectedCloseAt, new Date(repo.now))}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {o.daysStale > 14 && <Badge tone="amber">stale</Badge>}
                          {o.founderTouchRequired && <Badge tone="rose">founder</Badge>}
                          {o.blockers.length > 0 && <Badge tone="rose">blocker</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
