/**
 * Cross-Domain Synthesis Agent
 *
 * Unlike chief-of-staff-v2 (which summarizes all agent insights), this agent
 * deliberately combines signals ACROSS domains to surface compound risks and
 * compound opportunities that no single-domain agent can see:
 *
 *   - renewal at risk + open support burden + last QBR aged → churn risk
 *   - overdue AR + low CS health → dollars-at-risk
 *   - platform incidents hitting a high-value client → exec escalation
 *   - grant deadline + runway pressure → high-priority application
 *   - portfolio low-upside work consuming founder time → pause review
 *
 * Pure function. The host page fetches the component signals and passes them
 * in; this agent does the synthesis + ranking.
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'
import { rank, rankCompare, explainTopFactors, type RankOutput } from '../intelligence/rank.js'

export interface SynthesisAccount {
  accountId: string
  clientName: string
  contractValueCad: number
  healthScore: 'green' | 'yellow' | 'red' | 'unknown'
  renewalInDays: number | null
  openSupportTickets: number
  lastQbrDaysAgo: number | null
  overdueArCad: number
}

export interface SynthesisIncident {
  ticketId: string
  title: string
  priority: 'p1_critical' | 'p2_high' | 'p3_medium' | 'p4_low'
  affectedClientIds: string[]
  ageHours: number
}

export interface SynthesisGrant {
  grantId: string
  programName: string
  amountRequestedCad: number
  daysUntilDeadline: number
  stage: 'prospecting' | 'drafting' | 'submitted' | 'awarded' | 'declined' | 'reporting' | 'closed'
}

export interface SynthesisPortfolioItem {
  productKey: string
  founderHoursPerWeek: number
  revenueContributionCad: number
  strategicFit: 'high' | 'medium' | 'low'
}

export interface SynthesisSignal {
  runwayMonths: number | null
  accounts: ReadonlyArray<SynthesisAccount>
  incidents: ReadonlyArray<SynthesisIncident>
  grants: ReadonlyArray<SynthesisGrant>
  portfolio: ReadonlyArray<SynthesisPortfolioItem>
}

export interface RankedFinding {
  id: string
  kind: 'risk' | 'opportunity'
  title: string
  domains: string[] // e.g. ['revenue','platform']
  narrative: string
  rank: RankOutput
  confidence: number
  reversibility: number
  evidence: Record<string, unknown>
}

// ── Heuristic thresholds (explicit + easy to tune) ─────────────────────────
const RENEWAL_RISK_WINDOW_DAYS = 90
const QBR_STALE_DAYS = 120
const HIGH_SUPPORT_BURDEN = 5
const PREMIUM_ACCOUNT_CAD = 50_000
const LOW_RUNWAY_MONTHS = 6
const GRANT_URGENT_DAYS = 30
const PORTFOLIO_DRAG_HOURS_WEEKLY = 5
const PORTFOLIO_DRAG_REVENUE_CAD = 20_000

export function synthesizeFindings(signal: SynthesisSignal): RankedFinding[] {
  const findings: RankedFinding[] = []
  const runway = signal.runwayMonths
  const runwayPressure = runway !== null && runway <= LOW_RUNWAY_MONTHS
  const runwayPressureFactor = runway === null ? 0.3 : Math.max(0, Math.min(1, (LOW_RUNWAY_MONTHS - runway) / LOW_RUNWAY_MONTHS))

  // Indexed lookups
  const accountsByClientKey = new Map<string, SynthesisAccount>()
  for (const a of signal.accounts) accountsByClientKey.set(a.accountId, a)

  // ── 1. Churn risk: renewal near + yellow/red + stale QBR OR high support
  for (const a of signal.accounts) {
    const renewNear = a.renewalInDays !== null && a.renewalInDays <= RENEWAL_RISK_WINDOW_DAYS
    const healthBad = a.healthScore === 'red' || a.healthScore === 'yellow'
    const staleQbr = a.lastQbrDaysAgo !== null && a.lastQbrDaysAgo > QBR_STALE_DAYS
    const highSupport = a.openSupportTickets >= HIGH_SUPPORT_BURDEN
    if (!renewNear || !healthBad) continue
    if (!staleQbr && !highSupport) continue

    const urgency = a.renewalInDays === null ? 0.3 : Math.max(0, Math.min(1, (RENEWAL_RISK_WINDOW_DAYS - a.renewalInDays) / RENEWAL_RISK_WINDOW_DAYS))
    const confidence = a.healthScore === 'red' ? 0.9 : 0.7
    const rk = rank({
      estimatedValueCad: a.contractValueCad,
      urgency,
      confidence,
      effort: 0.3,
      reversibility: 0.6,
      founderUniqueness: a.contractValueCad >= PREMIUM_ACCOUNT_CAD ? 0.6 : 0.2,
      downsideIfIgnored: a.healthScore === 'red' ? 0.9 : 0.6,
      strategicLeverage: 0.3,
    })
    findings.push({
      id: `churn-risk:${a.accountId}`,
      kind: 'risk',
      title: `Churn risk: ${a.clientName}`,
      domains: ['revenue', 'operations'],
      narrative: `${a.clientName} renews in ${a.renewalInDays ?? '?'}d, health=${a.healthScore}${staleQbr ? `, QBR ${a.lastQbrDaysAgo}d stale` : ''}${highSupport ? `, ${a.openSupportTickets} open support tickets` : ''}. Contract value $${a.contractValueCad.toLocaleString('en-CA')}.`,
      rank: rk,
      confidence,
      reversibility: 0.6,
      evidence: {
        accountId: a.accountId,
        renewalInDays: a.renewalInDays,
        healthScore: a.healthScore,
        openSupportTickets: a.openSupportTickets,
        lastQbrDaysAgo: a.lastQbrDaysAgo,
      },
    })
  }

  // ── 2. Dollars-at-risk: overdue AR + low health
  for (const a of signal.accounts) {
    if (a.overdueArCad <= 0) continue
    if (a.healthScore !== 'red' && a.healthScore !== 'yellow') continue
    const rk = rank({
      estimatedValueCad: a.overdueArCad,
      urgency: 0.8,
      confidence: 0.9,
      effort: 0.2,
      reversibility: 0.4,
      founderUniqueness: 0.2,
      downsideIfIgnored: a.healthScore === 'red' ? 0.9 : 0.6,
      strategicLeverage: 0.2,
    })
    findings.push({
      id: `ar-risk:${a.accountId}`,
      kind: 'risk',
      title: `AR + health risk: ${a.clientName}`,
      domains: ['finance', 'revenue'],
      narrative: `$${a.overdueArCad.toLocaleString('en-CA')} overdue from ${a.clientName} (health=${a.healthScore}). Collection probability drops sharply when a client is already unhealthy.`,
      rank: rk,
      confidence: 0.9,
      reversibility: 0.4,
      evidence: { overdueArCad: a.overdueArCad, healthScore: a.healthScore },
    })
  }

  // ── 3. Platform → revenue: incident on premium account
  for (const inc of signal.incidents) {
    const impacted = inc.affectedClientIds
      .map((id) => accountsByClientKey.get(id))
      .filter((a): a is SynthesisAccount => !!a && a.contractValueCad >= PREMIUM_ACCOUNT_CAD)
    if (impacted.length === 0) continue
    const totalArr = impacted.reduce((s, a) => s + a.contractValueCad, 0)
    const priorityUrgency = inc.priority === 'p1_critical' ? 1 : inc.priority === 'p2_high' ? 0.7 : 0.4
    const rk = rank({
      estimatedValueCad: totalArr,
      urgency: priorityUrgency,
      confidence: 0.95,
      effort: 0.5,
      reversibility: 0.5,
      founderUniqueness: 0.5,
      downsideIfIgnored: 0.85,
      strategicLeverage: 0.4,
    })
    findings.push({
      id: `incident-premium:${inc.ticketId}`,
      kind: 'risk',
      title: `${inc.priority} incident hitting premium accounts`,
      domains: ['platform', 'revenue'],
      narrative: `${inc.title}. Affected: ${impacted.map((a) => a.clientName).join(', ')}. Combined ARR $${totalArr.toLocaleString('en-CA')}.`,
      rank: rk,
      confidence: 0.95,
      reversibility: 0.5,
      evidence: { ticketId: inc.ticketId, affectedAccounts: impacted.map((a) => a.accountId), totalArr },
    })
  }

  // ── 4. Grants + runway: grant deadline close while runway tight → high priority
  for (const g of signal.grants) {
    if (g.stage !== 'prospecting' && g.stage !== 'drafting') continue
    if (g.daysUntilDeadline < 0) continue
    const urgency = Math.max(0, Math.min(1, (GRANT_URGENT_DAYS - g.daysUntilDeadline) / GRANT_URGENT_DAYS))
    const confidence = g.stage === 'drafting' ? 0.8 : 0.5
    const runwayBoost = runwayPressure ? 0.4 : 0
    const rk = rank({
      estimatedValueCad: g.amountRequestedCad,
      urgency: urgency + runwayBoost,
      confidence,
      effort: g.stage === 'drafting' ? 0.4 : 0.7,
      reversibility: 0.9, // you can always walk away from a grant app
      founderUniqueness: 0.7, // usually founder-signed
      downsideIfIgnored: runwayPressure ? 0.8 : 0.3,
      strategicLeverage: runwayPressure ? 0.7 : 0.3,
    })
    findings.push({
      id: `grant-opportunity:${g.grantId}`,
      kind: 'opportunity',
      title: `Grant opportunity: ${g.programName}`,
      domains: ['finance', 'portfolio'],
      narrative: `${g.programName} · $${g.amountRequestedCad.toLocaleString('en-CA')} requested · deadline in ${g.daysUntilDeadline}d · stage=${g.stage}${runwayPressure ? `. Runway is ${runway}mo — this is high-leverage.` : ''}`,
      rank: rk,
      confidence,
      reversibility: 0.9,
      evidence: { grantId: g.grantId, daysUntilDeadline: g.daysUntilDeadline, stage: g.stage, runwayMonths: runway },
    })
  }

  // ── 5. Portfolio drag: low-revenue, high-founder-hours products
  for (const p of signal.portfolio) {
    if (p.founderHoursPerWeek < PORTFOLIO_DRAG_HOURS_WEEKLY) continue
    if (p.revenueContributionCad >= PORTFOLIO_DRAG_REVENUE_CAD) continue
    if (p.strategicFit === 'high') continue
    const rk = rank({
      estimatedValueCad: p.founderHoursPerWeek * 52 * 250, // founder hr ≈ $250 opportunity cost
      urgency: 0.4,
      confidence: 0.7,
      effort: 0.3, // deciding to pause is low effort
      reversibility: 0.8,
      founderUniqueness: 0.9,
      downsideIfIgnored: 0.4 + runwayPressureFactor * 0.3,
      strategicLeverage: 0.5,
    })
    findings.push({
      id: `portfolio-drag:${p.productKey}`,
      kind: 'opportunity',
      title: `Portfolio drag: ${p.productKey}`,
      domains: ['portfolio', 'operations'],
      narrative: `${p.productKey} consumes ${p.founderHoursPerWeek}hr/wk of founder time but contributes only $${p.revenueContributionCad.toLocaleString('en-CA')}/yr (strategic fit=${p.strategicFit}). Pausing or delegating frees founder capacity.`,
      rank: rk,
      confidence: 0.7,
      reversibility: 0.8,
      evidence: { productKey: p.productKey, founderHoursPerWeek: p.founderHoursPerWeek, revenueContributionCad: p.revenueContributionCad, strategicFit: p.strategicFit },
    })
  }

  return findings.sort(rankCompare)
}

export const crossDomainSynthesisAgent: ExecutiveAgent<SynthesisSignal> = {
  key: 'cross-domain-synthesis',
  name: 'Cross-Domain Synthesis',
  domain: 'executive',
  mission: 'Combine signals across domains to surface compound risks and opportunities no single agent can see.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const signal: SynthesisSignal = req.input ?? {
      runwayMonths: null,
      accounts: [],
      incidents: [],
      grants: [],
      portfolio: [],
    }

    const findings = synthesizeFindings(signal)
    if (findings.length === 0) {
      return { summary: 'No compound signals found.', insights: [], actions: [] }
    }

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    const risks = findings.filter((f) => f.kind === 'risk')
    const opps = findings.filter((f) => f.kind === 'opportunity')

    if (risks.length > 0) {
      const top = risks.slice(0, 5)
      insights.push({
        domain: 'executive',
        title: `${risks.length} compound risk${risks.length === 1 ? '' : 's'} across domains (top ${top.length})`,
        body: top
          .map((f) => `[${f.rank.bucket} · score ${f.rank.score}] ${f.title}\n${f.narrative}\nFactors: ${explainTopFactors(f.rank, 3)}`)
          .join('\n\n'),
        severity: top.some((f) => f.rank.bucket === 'now') ? 'critical' : 'warn',
        confidence: Math.min(1, top.reduce((s, f) => s + f.confidence, 0) / Math.max(1, top.length)),
        evidence: { count: risks.length, top: top.map((f) => f.id) },
        recommendedNextStep: 'Assign owners to the top 3 in today\'s operating sync.',
      })
      for (const r of top) {
        if (r.rank.bucket === 'now' || r.rank.bucket === 'today') {
          actions.push({
            actionClass: 'recommendation',
            title: r.title,
            description: r.narrative,
            payload: { ...r.evidence, rank: r.rank },
            requiresApproval: true,
            confidence: r.confidence,
            riskLevel: r.rank.bucket === 'now' ? 'critical' : 'high',
            insightRef: `${risks.length} compound risk${risks.length === 1 ? '' : 's'} across domains (top ${top.length})`,
          })
        }
      }
    }

    if (opps.length > 0) {
      const top = opps.slice(0, 5)
      insights.push({
        domain: 'executive',
        title: `${opps.length} opportunity signal${opps.length === 1 ? '' : 's'} across domains (top ${top.length})`,
        body: top
          .map((f) => `[${f.rank.bucket} · score ${f.rank.score}] ${f.title}\n${f.narrative}\nFactors: ${explainTopFactors(f.rank, 3)}`)
          .join('\n\n'),
        severity: 'info',
        confidence: Math.min(1, top.reduce((s, f) => s + f.confidence, 0) / Math.max(1, top.length)),
        evidence: { count: opps.length, top: top.map((f) => f.id) },
        recommendedNextStep: 'Pick the top 2 this week; defer the rest.',
      })
    }

    const summary = `Synthesis: ${risks.length} risks, ${opps.length} opportunities${findings[0] ? ` — top: ${findings[0].title}` : ''}.`
    return { summary, insights, actions }
  },
}
