/**
 * Deterministic report generators (Phase 17).
 *
 * Each generator returns a structured report payload (markdown + sections).
 * No I/O — callers persist or render the result.
 */
import type { Alert } from './automations'
import type {
  DependencyScore,
  FinanceSnapshot,
  Opportunity,
  PortfolioSnapshot,
  Venture,
} from './types'

export interface Report {
  kind:
    | 'weekly-ceo'
    | 'monthly-portfolio'
    | 'quarterly-board'
    | 'pipeline-review'
    | 'dependency-trend'
  generatedAt: string
  title: string
  summary: string
  sections: { heading: string; body: string }[]
  markdown: string
}

function fmtCurrencyCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

function joinLines(lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

export function generateWeeklyCeoBrief(input: {
  now: string
  portfolio: PortfolioSnapshot
  ventures: Venture[]
  alerts: Alert[]
  dependencyScores: DependencyScore[]
}): Report {
  const { now, portfolio, ventures, alerts, dependencyScores } = input
  const reds = dependencyScores.filter((s) => s.signal === 'red')
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')

  const summary = `Studio MRR ${fmtCurrencyCents(portfolio.totalMrrCents)}, weighted pipeline ${fmtCurrencyCents(
    portfolio.weightedPipelineCents,
  )}. Founder bottleneck score ${portfolio.founderBottleneckScore}/100 (${portfolio.founderBottleneckSignal}). ${criticalAlerts.length} critical alert(s), ${reds.length} venture(s) on RED dependency.`

  const sections = [
    {
      heading: 'Portfolio at a glance',
      body: joinLines([
        `- Active ventures: ${portfolio.activeVentures}`,
        `- Pilots live: ${portfolio.pilotsLive}`,
        `- Total MRR: ${fmtCurrencyCents(portfolio.totalMrrCents)}`,
        `- Weighted pipeline: ${fmtCurrencyCents(portfolio.weightedPipelineCents)}`,
        `- Strategic alerts: ${portfolio.strategicAlerts}`,
      ]),
    },
    {
      heading: 'Critical alerts',
      body:
        criticalAlerts.length === 0
          ? 'None this week — keep the discipline.'
          : joinLines(criticalAlerts.map((a) => `- **${a.title}** — ${a.detail}`)),
    },
    {
      heading: 'Founder dependency hotspots',
      body:
        reds.length === 0
          ? 'No ventures on RED. Continue to widen ownership.'
          : joinLines(
              reds.map(
                (s) =>
                  `- **${s.ventureSlug}** (score ${s.score}/100): ${s.reasons.join('; ') || 'No documented reasons'}`,
              ),
            ),
    },
    {
      heading: 'Ventures',
      body: joinLines(
        ventures.map(
          (v) =>
            `- **${v.name}** — stage ${v.stage}, MRR ${fmtCurrencyCents(v.monthlyRecurringRevenueCents)}, pipeline ${fmtCurrencyCents(v.pipelineValueCents)} (confidence: ${v.confidence})`,
        ),
      ),
    },
  ]

  const markdown = joinLines([
    `# Weekly CEO Brief — ${now.slice(0, 10)}`,
    '',
    `> ${summary}`,
    '',
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.body, '']),
  ])

  return {
    kind: 'weekly-ceo',
    generatedAt: now,
    title: `Weekly CEO Brief — ${now.slice(0, 10)}`,
    summary,
    sections,
    markdown,
  }
}

export function generatePipelineReview(input: {
  now: string
  opportunities: Opportunity[]
}): Report {
  const { now, opportunities } = input
  const stages = [
    'lead',
    'qualified',
    'proposal',
    'negotiation',
    'pilot',
    'won',
    'lost',
    'expansion',
  ] as const

  const byStage = stages.map((stage) => {
    const opps = opportunities.filter((o) => o.stage === stage)
    const value = opps.reduce((s, o) => s + o.estimatedValueCents, 0)
    const weighted = opps.reduce((s, o) => s + o.estimatedValueCents * o.probability, 0)
    return { stage, count: opps.length, value, weighted }
  })

  const founderTouch = opportunities.filter((o) => o.founderTouchRequired)
  const stale = opportunities.filter(
    (o) => o.daysStale > 14 && o.stage !== 'won' && o.stage !== 'lost',
  )

  const summary = `${opportunities.length} active opportunit${opportunities.length === 1 ? 'y' : 'ies'}, ${stale.length} stale, ${founderTouch.length} founder-touch required.`

  const sections = [
    {
      heading: 'Pipeline by stage',
      body: joinLines(
        byStage.map(
          (row) =>
            `- **${row.stage}**: ${row.count} deals, ${fmtCurrencyCents(row.value)} unweighted, ${fmtCurrencyCents(Math.round(row.weighted))} weighted`,
        ),
      ),
    },
    {
      heading: 'Stale deals (>14 days)',
      body:
        stale.length === 0
          ? 'No stale deals.'
          : joinLines(
              stale.map((o) => `- **${o.name}** — ${o.daysStale} days, next: ${o.nextAction}`),
            ),
    },
    {
      heading: 'Founder-touch required',
      body:
        founderTouch.length === 0
          ? 'None — operator team is unblocked.'
          : joinLines(
              founderTouch.map((o) => `- **${o.name}** (${o.ventureSlug}) — ${o.nextAction}`),
            ),
    },
  ]

  const markdown = joinLines([
    `# Pipeline Review — ${now.slice(0, 10)}`,
    '',
    `> ${summary}`,
    '',
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.body, '']),
  ])

  return {
    kind: 'pipeline-review',
    generatedAt: now,
    title: `Pipeline Review — ${now.slice(0, 10)}`,
    summary,
    sections,
    markdown,
  }
}

export function generateDependencyTrendReport(input: {
  now: string
  current: DependencyScore[]
  previous: DependencyScore[]
}): Report {
  const { now, current, previous } = input
  const previousByVenture = new Map(previous.map((s) => [s.ventureSlug, s]))

  const rows = current.map((s) => {
    const prev = previousByVenture.get(s.ventureSlug)
    const delta = prev ? s.score - prev.score : null
    return { venture: s.ventureSlug, current: s.score, signal: s.signal, delta }
  })

  const improving = rows.filter((r) => r.delta != null && r.delta < 0).length
  const worsening = rows.filter((r) => r.delta != null && r.delta > 0).length

  const summary = `${improving} ventures improving, ${worsening} worsening, ${rows.length - improving - worsening} flat or new.`

  const body = joinLines(
    rows.map((r) => {
      const arrow =
        r.delta == null
          ? 'new'
          : r.delta < 0
            ? `▼ ${Math.abs(r.delta)}`
            : r.delta > 0
              ? `▲ ${r.delta}`
              : '·'
      return `- **${r.venture}** (${r.signal}): ${r.current}/100 ${arrow}`
    }),
  )

  const sections = [{ heading: 'Per-venture deltas', body }]

  const markdown = joinLines([
    `# Founder Dependency Trend — ${now.slice(0, 10)}`,
    '',
    `> ${summary}`,
    '',
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.body, '']),
  ])

  return {
    kind: 'dependency-trend',
    generatedAt: now,
    title: `Founder Dependency Trend — ${now.slice(0, 10)}`,
    summary,
    sections,
    markdown,
  }
}

export function generateMonthlyPortfolioReview(input: {
  now: string
  portfolio: PortfolioSnapshot
  finance: FinanceSnapshot
  ventures: Venture[]
}): Report {
  const { now, portfolio, finance, ventures } = input

  const summary = `MRR ${fmtCurrencyCents(finance.totalMrrCents)} (ARR ${fmtCurrencyCents(
    finance.arrRunRateCents,
  )}). Top venture concentration ${Math.round(finance.topVentureRevenueShare * 100)}%. Founder bottleneck ${portfolio.founderBottleneckScore}/100.`

  const sections = [
    {
      heading: 'Studio finance',
      body: joinLines([
        `- MRR: ${fmtCurrencyCents(finance.totalMrrCents)}`,
        `- ARR run-rate: ${fmtCurrencyCents(finance.arrRunRateCents)}`,
        `- Pipeline value: ${fmtCurrencyCents(finance.pipelineValueCents)}`,
        `- Weighted pipeline: ${fmtCurrencyCents(finance.weightedPipelineCents)}`,
        `- Cash runway: ${finance.cashRunwayMonths == null ? 'n/a' : `${finance.cashRunwayMonths} months`}`,
      ]),
    },
    {
      heading: 'Ventures',
      body: joinLines(
        ventures.map(
          (v) =>
            `- **${v.name}**: MRR ${fmtCurrencyCents(v.monthlyRecurringRevenueCents)}, stage ${v.stage}, confidence ${v.confidence}`,
        ),
      ),
    },
  ]

  const markdown = joinLines([
    `# Monthly Portfolio Review — ${now.slice(0, 10)}`,
    '',
    `> ${summary}`,
    '',
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.body, '']),
  ])

  return {
    kind: 'monthly-portfolio',
    generatedAt: now,
    title: `Monthly Portfolio Review — ${now.slice(0, 10)}`,
    summary,
    sections,
    markdown,
  }
}
