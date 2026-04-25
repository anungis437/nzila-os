/**
 * Intelligence Home — Executive Operating System
 *
 * Palantir × Bloomberg × Stripe Internal Ops × Founder OS
 * Answers: Where is money? Which grants? Which partners? Which products?
 * Which deals are moving? Which risks are emerging? What should Michel do next?
 *
 * Server Component — all data loaded at request time, zero client JS.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import {
  getDashboardKpis,
  getFundingOpportunities,
  getDealPipeline,
  getPartners,
  scoreProducts,
  detectRisks,
  generateWeeklyBriefing,
  getDataSourceHealth,
  generateExecutiveInsights,
  getFounderDecisions,
  getMichelWeeklyActions,
  getUpcomingDeadlines,
} from '@nzila/platform-intelligence-home'
import type {
  FundingOpportunity,
  Deal,
  Partner,
  ProductScore,
  Risk,
  DataSourceHealth,
  WeeklyBriefing,
  ExecutiveInsight,
  FounderDecision,
  MichelAction,
} from '@nzila/platform-intelligence-home'

export const dynamic = 'force-dynamic'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCad(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function statusDot(status: string): string {
  const map: Record<string, string> = {
    healthy: 'bg-emerald-400',
    active: 'bg-emerald-400',
    negotiating: 'bg-blue-400',
    watch: 'bg-amber-400',
    stale: 'bg-amber-400',
    failed: 'bg-rose-500',
    never_run: 'bg-gray-300',
    prospect: 'bg-gray-300',
    apply: 'bg-emerald-500',
    submitted: 'bg-blue-400',
    awarded: 'bg-emerald-700',
    rejected: 'bg-rose-400',
    expired: 'bg-gray-400',
    running: 'bg-blue-300 animate-pulse',
    inactive: 'bg-gray-200',
    paused: 'bg-amber-200',
  }
  return map[status] ?? 'bg-gray-300'
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    apply: 'bg-emerald-100 text-emerald-800',
    watch: 'bg-amber-100 text-amber-800',
    submitted: 'bg-blue-100 text-blue-800',
    awarded: 'bg-emerald-200 text-emerald-900',
    rejected: 'bg-rose-100 text-rose-800',
    expired: 'bg-gray-100 text-gray-500',
    healthy: 'bg-emerald-100 text-emerald-800',
    stale: 'bg-amber-100 text-amber-800',
    failed: 'bg-rose-100 text-rose-800',
    never_run: 'bg-gray-100 text-gray-600',
    prospect: 'bg-gray-100 text-gray-600',
    active: 'bg-emerald-100 text-emerald-800',
    negotiating: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-500',
    paused: 'bg-amber-50 text-amber-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

function severityBadge(sev: string): string {
  const map: Record<string, string> = {
    critical: 'bg-rose-100 text-rose-800 border border-rose-200',
    high: 'bg-amber-100 text-amber-800 border border-amber-200',
    medium: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
    low: 'bg-blue-50 text-blue-700 border border-blue-200',
  }
  return map[sev] ?? 'bg-gray-100 text-gray-600'
}

function signalConfig(signal: ExecutiveInsight['signal']): {
  dot: string
  badge: string
  label: string
  border: string
} {
  const m = {
    action_required: { dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800', label: 'Act Now', border: 'border-rose-200' },
    warning: { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800', label: 'Warning', border: 'border-amber-200' },
    opportunity: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', label: 'Opportunity', border: 'border-emerald-200' },
    trend: { dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-800', label: 'Trend', border: 'border-blue-200' },
  }
  return m[signal]
}

function michelTypeConfig(type: MichelAction['actionType']): { icon: string; color: string } {
  const m: Record<string, { icon: string; color: string }> = {
    legal_review: { icon: '⚖️', color: 'text-violet-700 bg-violet-50' },
    negotiation: { icon: '🤝', color: 'text-blue-700 bg-blue-50' },
    sponsor_call: { icon: '📞', color: 'text-emerald-700 bg-emerald-50' },
    grant_submission: { icon: '📋', color: 'text-rose-700 bg-rose-50' },
    strategic_intro: { icon: '🔗', color: 'text-amber-700 bg-amber-50' },
    deal_advance: { icon: '🚀', color: 'text-blue-700 bg-blue-50' },
    approve_document: { icon: '✅', color: 'text-gray-700 bg-gray-50' },
  }
  return m[type] ?? { icon: '•', color: 'text-gray-700 bg-gray-50' }
}

// ── Tab Nav ───────────────────────────────────────────────────────────────────

function SectionTabs({
  section,
  counts,
}: {
  section: string
  counts: { funding: number; deals: number; risks: number; insights: number; michel: number }
}) {
  const tabs = [
    { id: 'overview', label: 'Overview', badge: null as string | null },
    { id: 'insights', label: 'Insights', badge: counts.insights > 0 ? String(counts.insights) : null },
    { id: 'decisions', label: 'Decisions', badge: '5' as string | null },
    { id: 'michel', label: 'Michel', badge: counts.michel > 0 ? String(counts.michel) : null },
    { id: 'funding', label: 'Funding', badge: counts.funding > 0 ? `${counts.funding} apply` : null },
    { id: 'deals', label: 'Deals', badge: counts.deals > 0 ? String(counts.deals) : null },
    { id: 'partners', label: 'Partners', badge: null as string | null },
    { id: 'products', label: 'Products', badge: null as string | null },
    { id: 'risks', label: 'Risks', badge: counts.risks > 0 ? String(counts.risks) : null },
    { id: 'data-sources', label: 'Data', badge: null as string | null },
  ]
  return (
    <div className="flex gap-0 border-b border-slate-700 px-6 overflow-x-auto">
      {tabs.map((t) => {
        const active = section === t.id
        return (
          <a
            key={t.id}
            href={`/intelligence?section=${t.id}`}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              active
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none ${
                  active ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {t.badge}
              </span>
            )}
          </a>
        )
      })}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewSection({
  briefing,
  funding,
  deals,
  scored,
  risks,
  insights,
  decisions,
}: {
  briefing: WeeklyBriefing
  funding: FundingOpportunity[]
  deals: Deal[]
  scored: ProductScore[]
  risks: Risk[]
  insights: ExecutiveInsight[]
  decisions: FounderDecision[]
}) {
  const topFunding = funding.filter((f) => f.status === 'apply').sort((a, b) => b.confidenceScore - a.confidenceScore)[0]
  const topDeal = [...deals].sort((a, b) => (b.probability * b.estimatedValueCad) - (a.probability * a.estimatedValueCad))[0]
  const topProduct = scored[0]
  const topRisk = risks.find((r) => r.severity === 'critical') ?? risks[0]
  const topInsights = insights.slice(0, 3)
  const hoursDecision = decisions.find((d) => d.question === 'where_to_spend_20_hours')

  return (
    <div className="space-y-6">
      {/* North Star + Decision Engine 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-700">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">This Week&apos;s North Star</p>
          <p className="text-base font-semibold leading-relaxed">{briefing.northStar}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">{briefing.staleDeals} stale deals</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">{briefing.fundingDeadlinesIn30d} deadlines in 30d</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">{briefing.actions.length} actions queued</span>
          </div>
        </div>
        {hoursDecision && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Decision Engine</p>
            <p className="text-xs text-gray-500 mb-2">{hoursDecision.questionLabel}</p>
            <p className="text-sm font-bold text-gray-900 mb-3">{hoursDecision.answer}</p>
            <p className="text-xs text-gray-600 leading-relaxed">{hoursDecision.rationale}</p>
            {hoursDecision.value && (
              <p className="mt-3 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">
                {hoursDecision.value}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 4 signal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topFunding && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-emerald-600 mb-1.5">Top Grant</p>
            <p className="font-semibold text-gray-900 text-sm leading-snug">{topFunding.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{topFunding.agency}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700">{topFunding.confidenceScore}%</span>
              {topFunding.typicalMaxCad && (
                <span className="text-xs text-gray-500">up to {fmtCad(topFunding.typicalMaxCad)}</span>
              )}
            </div>
          </div>
        )}
        {topDeal && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-blue-600 mb-1.5">Top Deal</p>
            <p className="font-semibold text-gray-900 text-sm leading-snug">{topDeal.org}</p>
            <p className="text-xs text-gray-500 mt-0.5">{topDeal.product} · {topDeal.stage.replace(/_/g, ' ')}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700">{topDeal.probability}% prob</span>
              {topDeal.estimatedValueCad > 0 && (
                <span className="text-xs text-gray-500">{fmtCad(topDeal.estimatedValueCad)}/yr</span>
              )}
            </div>
          </div>
        )}
        {topProduct && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-violet-600 mb-1.5">Priority Product</p>
            <p className="font-semibold text-gray-900 text-sm capitalize leading-snug">{topProduct.productId.replace(/-/g, ' ')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Score: {topProduct.totalScore.toFixed(0)}/100</p>
            <div className="mt-2">
              <p className="text-xs text-gray-600 truncate">{topProduct.strengths[0]}</p>
            </div>
          </div>
        )}
        {topRisk && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-rose-600 mb-1.5">Top Risk</p>
            <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{topRisk.title}</p>
            <div className="mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${severityBadge(topRisk.severity)}`}>
                {topRisk.severity}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top Insights preview */}
      {topInsights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Live Intelligence Signals</h3>
            <a href="/intelligence?section=insights" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View all →
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {topInsights.map((ins) => {
              const cfg = signalConfig(ins.signal)
              return (
                <div key={ins.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{ins.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ins.body}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Weekly Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">This Week&apos;s Actions</h3>
          <span className="text-xs text-gray-400">week of {briefing.weekEnding}</span>
        </div>
        {briefing.actions.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No actions generated — all signals nominal.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {briefing.actions.map((action, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                <span
                  className={`shrink-0 mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    action.category === 'funding'
                      ? 'bg-emerald-100 text-emerald-700'
                      : action.category === 'deal'
                        ? 'bg-blue-100 text-blue-700'
                        : action.category === 'product'
                          ? 'bg-violet-100 text-violet-700'
                          : action.category === 'data'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {action.category}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{action.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{action.rationale}</p>
                  {action.estimatedImpact && (
                    <p className="text-xs font-medium text-emerald-700 mt-1">{action.estimatedImpact}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded font-semibold ${
                    action.priority === 1
                      ? 'bg-rose-100 text-rose-700'
                      : action.priority === 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  P{action.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Insights Section ─────────────────────────────────────────────────────────

function InsightsSection({ insights }: { insights: ExecutiveInsight[] }) {
  const actRequired = insights.filter((i) => i.signal === 'action_required')
  const warnings = insights.filter((i) => i.signal === 'warning')
  const opportunities = insights.filter((i) => i.signal === 'opportunity')
  const trends = insights.filter((i) => i.signal === 'trend')
  const groups = [
    { label: 'Act Now', items: actRequired, color: 'text-rose-700' },
    { label: 'Warnings', items: warnings, color: 'text-amber-700' },
    { label: 'Opportunities', items: opportunities, color: 'text-emerald-700' },
    { label: 'Trends', items: trends, color: 'text-blue-700' },
  ].filter((g) => g.items.length > 0)

  if (insights.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No insights generated — all signals within normal parameters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className={`text-xs uppercase tracking-widest font-semibold mb-3 ${group.color}`}>{group.label}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {group.items.map((ins) => {
              const cfg = signalConfig(ins.signal)
              return (
                <div key={ins.id} className={`bg-white border rounded-2xl p-5 shadow-sm ${cfg.border}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <p className="text-sm font-semibold text-gray-900 leading-snug flex-1">{ins.title}</p>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed pl-5">{ins.body}</p>
                  <div className="mt-3 pl-5 flex items-center gap-3">
                    {ins.product && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium capitalize">
                        {ins.product.replace(/-/g, ' ')}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {ins.confidence}% confidence · {ins.source}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Decisions Section ─────────────────────────────────────────────────────────

function DecisionsSection({ decisions }: { decisions: FounderDecision[] }) {
  return (
    <div className="space-y-5">
      <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 border border-slate-700">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Decision Engine</p>
        <p className="text-sm text-slate-300">
          Five founder-level questions answered from live data — pipeline, funding, partners, and product scoring.
          These are deterministic outputs, not AI guesses.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {decisions.map((d) => (
          <div key={d.question} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{d.questionLabel}</p>
            <p className="text-base font-bold text-gray-900 mb-3 leading-snug">{d.answer}</p>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.confidence >= 80 ? 'bg-emerald-400' : d.confidence >= 60 ? 'bg-amber-400' : 'bg-gray-400'
                  }`}
                  style={{ width: `${d.confidence}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 tabular-nums shrink-0">{d.confidence}% confidence</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">{d.rationale}</p>
            <div className="space-y-1">
              {d.dataPoints.map((dp, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-gray-300 text-xs mt-0.5 shrink-0">·</span>
                  <p className="text-xs text-gray-500">{dp}</p>
                </div>
              ))}
            </div>
            {d.value && (
              <p className="mt-4 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">
                {d.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Michel Panel ──────────────────────────────────────────────────────────────

function MichelSection({ actions }: { actions: MichelAction[] }) {
  const p1 = actions.filter((a) => a.priority === 1)
  const p2 = actions.filter((a) => a.priority === 2)
  const p3 = actions.filter((a) => a.priority === 3)
  const groups = [
    { label: 'Do This Week', desc: 'Time-sensitive — high-leverage founder actions', items: p1, accent: 'text-rose-700', pill: 'bg-rose-100 text-rose-700' },
    { label: 'This Week If Time', desc: 'Important but can shift one day', items: p2, accent: 'text-amber-700', pill: 'bg-amber-100 text-amber-700' },
    { label: 'This Month', desc: 'Strategic but not deadline-driven', items: p3, accent: 'text-gray-600', pill: 'bg-gray-100 text-gray-600' },
  ].filter((g) => g.items.length > 0)

  if (actions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No actions generated — check back after updating the deal pipeline.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 border border-slate-700">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Michel Mode</p>
        <p className="text-sm text-slate-300">
          Tailored weekly actions for Michel&apos;s dual role as Legal Counsel + President. Each action is selected
          because Michel&apos;s legal training, signing authority, or founder-level relationship capital gives a
          leverage advantage that cannot be delegated.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-3">
            <h3 className={`text-xs uppercase tracking-widest font-semibold ${group.accent}`}>{group.label}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{group.desc}</p>
          </div>
          <div className="space-y-3">
            {group.items.map((action) => {
              const typeConf = michelTypeConfig(action.actionType)
              return (
                <div key={action.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <span className={`text-lg shrink-0 w-8 h-8 flex items-center justify-center rounded-xl ${typeConf.color}`}>
                      {typeConf.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 flex-1 leading-snug">{action.title}</p>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${group.pill}`}>
                          P{action.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">{action.context}</p>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Why Michel</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{action.leverage}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-gray-500">⏱ {action.estimatedTime}</span>
                        {action.product && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium capitalize">
                            {action.product.replace(/-/g, ' ')}
                          </span>
                        )}
                        {action.dueBy && (
                          <span className="text-xs text-rose-600 font-medium">Due: {action.dueBy}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Funding ───────────────────────────────────────────────────────────────────

function FundingSection({ funding }: { funding: FundingOpportunity[] }) {
  const sorted = [...funding].sort((a, b) => {
    const order: Record<string, number> = { apply: 0, watch: 1, submitted: 2, awarded: 3, rejected: 4, expired: 5 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return b.confidenceScore - a.confidenceScore
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Canadian Funding Programs</h3>
        <p className="text-xs text-gray-500 mt-0.5">{funding.filter(f => f.status === 'apply').length} actionable · {funding.filter(f => f.status === 'watch').length} watching</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Program</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agency</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Confidence</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{f.name}</p>
                  {f.notes && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{f.notes}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.agency}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(f.status)}`}>
                    {f.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${f.confidenceScore}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 tabular-nums">{f.confidenceScore}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                  {f.daysUntilDeadline !== null ? (
                    <span className={f.daysUntilDeadline <= 14 ? 'text-rose-600 font-semibold' : f.daysUntilDeadline <= 30 ? 'text-amber-600 font-medium' : ''}>
                      {f.daysUntilDeadline}d
                    </span>
                  ) : (
                    <span className="text-gray-400">{f.intakeTiming?.split(' —')[0] ?? 'rolling'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 tabular-nums whitespace-nowrap">
                  {f.typicalMaxCad ? fmtCad(f.typicalMaxCad) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Deals ─────────────────────────────────────────────────────────────────────

function DealsSection({ deals }: { deals: Deal[] }) {
  const stageOrder: Record<string, number> = {
    'closed_won': 0, 'pilot_active': 1, 'negotiation': 2, 'proposal': 3,
    'discovery': 4, 'prospect': 5, 'stale': 6, 'closed_lost': 7,
  }
  const stageSorted = [...deals].sort((a, b) => (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9))

  const negotiatingCount = deals.filter((d) => d.stage === 'negotiation').length
  const proposalCount = deals.filter((d) => d.stage === 'proposal').length
  const pilotActiveCount = deals.filter((d) => d.stage === 'pilot_active').length
  const totalWeightedCad = deals.reduce((s, d) => s + (d.estimatedValueCad * d.probability) / 100, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-800 tabular-nums">{negotiatingCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-blue-600 mt-0.5">Negotiating</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-indigo-800 tabular-nums">{proposalCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-indigo-600 mt-0.5">Proposal</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-emerald-800 tabular-nums">{pilotActiveCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 mt-0.5">Pilot Active</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmtCad(totalWeightedCad)}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">Weighted Pipeline</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Deal Pipeline — {deals.length} deals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Org</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Prob</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Value/yr</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stageSorted.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{d.org}</p>
                  <p className="text-xs text-gray-400">{d.owner}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium capitalize">
                      {d.product.replace(/-/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.stage === 'negotiation' ? 'bg-emerald-100 text-emerald-800' :
                      d.stage === 'proposal' ? 'bg-blue-100 text-blue-800' :
                      d.stage === 'pilot_active' ? 'bg-violet-100 text-violet-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {d.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${d.probability}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 tabular-nums">{d.probability}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 tabular-nums">{fmtCad(d.estimatedValueCad)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={d.daysSinceActivity > 30 ? 'text-rose-600 font-semibold' : d.daysSinceActivity > 14 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                      {d.daysSinceActivity}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Partners ──────────────────────────────────────────────────────────────────

function PartnersSection({ partners }: { partners: Partner[] }) {
  const byDomain: Record<string, Partner[]> = {}
  for (const p of partners) {
    const domain = p.primaryDomain ?? 'other'
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(p)
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDomain).sort(([a], [b]) => a.localeCompare(b)).map(([domain, list]) => (
        <div key={domain} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 capitalize">{domain.replace(/-/g, ' ')}</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {list.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot(p.status)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {p.contactName && <p className="text-xs text-gray-400">{p.contactName}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusBadge(p.status)}`}>
                  {p.status}
                </span>
                {p.annualValueCad > 0 && (
                  <span className="text-xs text-gray-500 tabular-nums shrink-0">{fmtCad(p.annualValueCad)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Products ──────────────────────────────────────────────────────────────────

function ProductsSection({ scored }: { scored: ProductScore[] }) {
  const dimLabels: Record<string, string> = {
    pipelineDemand: 'Pipeline Demand',
    strategicFit: 'Strategic Fit',
    revenueSpeed: 'Revenue Speed',
    implementationReadiness: 'Impl. Readiness',
    founderLeverage: 'Founder Leverage',
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {scored.map((p) => (
        <div key={p.productId} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 tabular-nums">#{p.rank}</span>
                <h3 className="text-sm font-semibold text-gray-900 capitalize">{p.productId.replace(/-/g, ' ')}</h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-400"
                    style={{ width: `${p.totalScore}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{p.totalScore.toFixed(0)}</span>
              </div>
            </div>
            <span className="text-xs text-gray-400">{p.recommendedFocusHours}h/wk</span>
          </div>

          {/* Dimension bars */}
          <div className="space-y-1.5 mb-3">
            {([
              ['pipelineDemand', p.pipelineDemand],
              ['strategicFit', p.strategicFit],
              ['revenueSpeed', p.revenueSpeed],
              ['implementationReadiness', p.implementationReadiness],
              ['founderLeverage', p.founderLeverage],
            ] as [string, number][]).map(([dim, score]) => (
              <div key={dim} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{dimLabels[dim] ?? dim}</span>
                <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-slate-400" style={{ width: `${score}%` }} />
                </div>
                <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{score}</span>
              </div>
            ))}
          </div>

          {/* Strengths / Gaps */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-1">Strengths</p>
              {p.strengths.slice(0, 2).map((s, i) => (
                <p key={i} className="text-emerald-700 leading-relaxed">↑ {s}</p>
              ))}
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide text-[10px] mb-1">Gaps</p>
              {p.gaps.slice(0, 2).map((g, i) => (
                <p key={i} className="text-amber-700 leading-relaxed">↓ {g}</p>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Risks ─────────────────────────────────────────────────────────────────────

function RisksSection({ risks }: { risks: Risk[] }) {
  const bySev: Record<string, Risk[]> = {}
  for (const r of risks) {
    if (!bySev[r.severity]) bySev[r.severity] = []
    bySev[r.severity].push(r)
  }

  const sevOrder = ['critical', 'high', 'medium', 'low']

  return (
    <div className="space-y-4">
      {sevOrder.filter((s) => bySev[s]?.length).map((sev) => (
        <div key={sev} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className={`px-5 py-3 border-b ${
            sev === 'critical' ? 'bg-rose-50 border-rose-100' :
            sev === 'high' ? 'bg-amber-50 border-amber-100' :
            sev === 'medium' ? 'bg-yellow-50 border-yellow-100' :
            'bg-blue-50 border-blue-100'
          }`}>
            <h3 className="text-sm font-semibold capitalize text-gray-900">{sev} Risks ({bySev[sev].length})</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {bySev[sev].map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium mt-0.5 ${severityBadge(r.severity)}`}>
                    {r.category}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.detail}</p>
                    <p className="text-xs text-blue-700 mt-1.5 font-medium">→ {r.recommendedAction}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Data Sources ──────────────────────────────────────────────────────────────

function DataSourcesSection({ syncHealth }: { syncHealth: DataSourceHealth[] }) {
  const sorted = [...syncHealth].sort((a, b) => {
    const order: Record<string, number> = { failed: 0, never_run: 1, stale: 2, running: 3, healthy: 4 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Data Source Ingestion Health</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {syncHealth.filter(s => s.status === 'healthy').length} healthy ·{' '}
          {syncHealth.filter(s => s.status === 'failed').length} failed ·{' '}
          {syncHealth.filter(s => s.status === 'never_run').length} never run
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Sync</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Records</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((s) => (
              <tr key={s.sourceId} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot(s.status)}`} />
                    <div>
                      <p className="font-medium text-gray-900">{s.sourceName}</p>
                      <p className="text-xs text-gray-400">{s.sourceId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(s.status)}`}>
                    {s.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString('en-CA') : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 tabular-nums">
                  {s.lastSyncRecords > 0 ? s.lastSyncRecords.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                  {s.errorMessage ? (
                    <span className="text-rose-600">{s.errorMessage}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { section = 'overview' } = await searchParams

  const [kpis, funding, deals, partners, scored, risks, briefing, syncHealth, insights, decisions, michelActions] =
    await Promise.all([
      getDashboardKpis(),
      getFundingOpportunities(),
      getDealPipeline(),
      getPartners(),
      scoreProducts(),
      detectRisks(),
      generateWeeklyBriefing(),
      getDataSourceHealth(),
      generateExecutiveInsights(),
      getFounderDecisions(),
      getMichelWeeklyActions(),
    ])

  const now = new Date()

  const tabCounts = {
    funding: funding.filter((f) => f.status === 'apply').length,
    deals: deals.filter((d) => !['closed_lost', 'closed_won', 'stale'].includes(d.stage)).length,
    risks: risks.filter((r) => r.severity === 'critical' || r.severity === 'high').length,
    insights: insights.length,
    michel: michelActions.length,
  }

  const actionRequired = insights.filter((i) => i.signal === 'action_required')
  const deadlines30 = getUpcomingDeadlines(30)
  const showAlert = actionRequired.length > 0 || deadlines30.length > 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-950 border-b border-slate-800">
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Nzila OS · Intelligence</p>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Executive Operating System</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">
              {now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">All data deterministic · Live seed</p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="px-6 pb-4 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {[
            { label: 'Grants', value: String(kpis.openFundingCount), color: 'text-emerald-400' },
            { label: 'Grant Pool', value: fmtCad(kpis.totalFundingAvailableCad), color: 'text-emerald-400' },
            { label: 'Pipeline', value: fmtCad(kpis.weightedPipelineCad), color: 'text-blue-400' },
            { label: 'Deals', value: String(deals.length), color: 'text-white' },
            { label: 'Partners', value: String(kpis.activePartners), color: 'text-white' },
            { label: 'In Focus', value: String(kpis.productsInFocus), color: 'text-violet-400' },
            { label: 'Deadlines', value: String(kpis.deadlinesIn30d), color: kpis.deadlinesIn30d > 0 ? 'text-amber-400' : 'text-white' },
            { label: 'Data', value: `${kpis.dataSourceHealthPct}%`, color: kpis.dataSourceHealthPct >= 80 ? 'text-emerald-400' : kpis.dataSourceHealthPct >= 50 ? 'text-amber-400' : 'text-rose-400' },
            { label: 'Critical', value: String(kpis.criticalRisksCount), color: kpis.criticalRisksCount > 0 ? 'text-rose-400' : 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">{label}</p>
              <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <SectionTabs section={section} counts={tabCounts} />
      </div>

      {showAlert && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <p className="text-sm font-medium text-rose-800">
              {actionRequired.length > 0
                ? actionRequired[0].title
                : `${deadlines30.length} grant deadline${deadlines30.length !== 1 ? 's' : ''} within 30 days`}
            </p>
            {(actionRequired.length > 1 || deadlines30.length > 0) && (
              <a href="/intelligence?section=insights" className="text-xs text-rose-600 font-semibold hover:text-rose-800 underline">
                View all signals →
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {section === 'overview' && (
          <OverviewSection
            briefing={briefing}
            funding={funding}
            deals={deals}
            scored={scored}
            risks={risks}
            insights={insights}
            decisions={decisions}
          />
        )}
        {section === 'insights' && <InsightsSection insights={insights} />}
        {section === 'decisions' && <DecisionsSection decisions={decisions} />}
        {section === 'michel' && <MichelSection actions={michelActions} />}
        {section === 'funding' && <FundingSection funding={funding} />}
        {section === 'deals' && <DealsSection deals={deals} />}
        {section === 'partners' && <PartnersSection partners={partners} />}
        {section === 'products' && <ProductsSection scored={scored} />}
        {section === 'risks' && <RisksSection risks={risks} />}
        {section === 'data-sources' && <DataSourcesSection syncHealth={syncHealth} />}
      </div>
    </div>
  )
}
