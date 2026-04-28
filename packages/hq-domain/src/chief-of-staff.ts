/**
 * Chief of Staff — Phase 4.
 *
 * Three deterministic, LLM-free generators for the founder's daily/weekly
 * cadence. The intent is honest signal: we don't fabricate priorities, we
 * derive them from the same engines (allocation, dependency, automations,
 * finance) the rest of HQ already trusts.
 *
 * If/when an LLM is wired in, it will be a *paraphrasing* layer over these
 * deterministic outputs — never the source of truth.
 */
import type { Alert } from './automations'
import type { AllocationDelta } from './allocation-2'
import type { AllocationScore } from './allocation-engine'
import type { DependencyScore, Opportunity, Task, Venture } from './types'
import type { ScenarioResult } from './finance-engine'

export interface ChiefOfStaffOutput {
  generatedAt: string
  title: string
  summary: string
  bullets: string[]
  markdown: string
}

// ── 1) Today's Top Five — what to do RIGHT NOW ─────────────────────────────

export interface TopFiveInput {
  now: string
  tasks: readonly Task[]
  opportunities: readonly Opportunity[]
  alerts: readonly Alert[]
  founderUserId: string
}

export function generateTodayTopFive(input: TopFiveInput): ChiefOfStaffOutput {
  const candidates: { score: number; bullet: string }[] = []

  // Critical alerts always lead.
  for (const a of input.alerts) {
    const score = a.severity === 'critical' ? 100 : a.severity === 'warn' ? 60 : 30
    candidates.push({
      score,
      bullet: `🚨 **${a.title}** — ${a.suggestedAction || a.detail}`,
    })
  }

  // Founder-touch deals at high probability.
  for (const o of input.opportunities) {
    if (!o.founderTouchRequired) continue
    if (o.stage === 'won' || o.stage === 'lost') continue
    const score = Math.round(70 + o.probability * 30)
    candidates.push({
      score,
      bullet: `🤝 **${o.name}** — ${o.nextAction} (${Math.round(o.probability * 100)}% / ${o.daysStale}d stale)`,
    })
  }

  // Founder-owned overdue tasks.
  const nowMs = Date.parse(input.now)
  for (const t of input.tasks) {
    if (t.ownerUserId !== input.founderUserId) continue
    if (t.status === 'done') continue
    const dueMs = t.dueAt ? Date.parse(t.dueAt) : null
    const overdueDays = dueMs != null ? Math.floor((nowMs - dueMs) / 86_400_000) : 0
    if (dueMs == null) continue
    const score = overdueDays > 0 ? 80 + Math.min(20, overdueDays) : 50
    if (overdueDays > 0) {
      candidates.push({
        score,
        bullet: `⏰ **${t.title}** — overdue ${overdueDays}d (${t.queue})`,
      })
    }
  }

  const top = candidates.sort((a, b) => b.score - a.score).slice(0, 5)
  const bullets = top.map((c) => c.bullet)

  const summary =
    bullets.length === 0
      ? 'Inbox zero — no critical items right now. Use the time on the most strategic move from /allocation.'
      : `${bullets.length} item${bullets.length === 1 ? '' : 's'} ranked by impact and urgency.`

  const markdown = `# Today's Top Five — ${input.now.slice(0, 10)}\n\n> ${summary}\n\n${bullets.map((b) => `- ${b}`).join('\n')}\n`

  return {
    generatedAt: input.now,
    title: `Today's Top Five — ${input.now.slice(0, 10)}`,
    summary,
    bullets,
    markdown,
  }
}

// ── 2) Urgent Risk Digest — what could blow up this week ───────────────────

export interface RiskDigestInput {
  now: string
  alerts: readonly Alert[]
  dependencyScores: readonly DependencyScore[]
  ventures: readonly Venture[]
  /** Optional finance scenario where the worst case has already been computed. */
  worstCaseScenario?: ScenarioResult
}

export function generateUrgentRiskDigest(input: RiskDigestInput): ChiefOfStaffOutput {
  const lines: string[] = []
  const ventureBySlug = new Map(input.ventures.map((v) => [v.slug, v]))

  const reds = input.dependencyScores.filter((s) => s.signal === 'red')
  const criticalAlerts = input.alerts.filter((a) => a.severity === 'critical')

  if (criticalAlerts.length > 0) {
    lines.push(`### Critical operational alerts (${criticalAlerts.length})`)
    for (const a of criticalAlerts) {
      lines.push(
        `- **${a.title}** — ${a.detail}${a.suggestedAction ? ` _(action: ${a.suggestedAction})_` : ''}`,
      )
    }
  }

  if (reds.length > 0) {
    lines.push('', `### Founder-dependency RED (${reds.length})`)
    for (const r of reds) {
      const v = ventureBySlug.get(r.ventureSlug)
      lines.push(
        `- **${v?.name ?? r.ventureSlug}** — ${r.score}/100. ${r.reasons[0] ?? 'Reason not documented.'}`,
      )
    }
  }

  if (input.worstCaseScenario) {
    const s = input.worstCaseScenario
    lines.push('', '### Cash worst-case')
    lines.push(
      `- Baseline runway: ${s.baseline.runwayMonths == null ? 'profitable' : `${s.baseline.runwayMonths} mo`}.`,
    )
    lines.push(
      `- Scenario runway: ${s.scenario.runwayMonths == null ? 'profitable' : `${s.scenario.runwayMonths} mo`}.`,
    )
    for (const n of s.notes) lines.push(`  - ${n}`)
  }

  const bullets = lines
  const summary =
    criticalAlerts.length + reds.length === 0
      ? 'No urgent risks detected this cycle.'
      : `${criticalAlerts.length} critical alert(s), ${reds.length} dependency-RED venture(s).`

  const markdown = `# Urgent Risk Digest — ${input.now.slice(0, 10)}\n\n> ${summary}\n\n${lines.join('\n')}\n`

  return {
    generatedAt: input.now,
    title: `Urgent Risk Digest — ${input.now.slice(0, 10)}`,
    summary,
    bullets,
    markdown,
  }
}

// ── 3) Capital Direction Memo — where money/time should move next ──────────

export interface CapitalDirectionInput {
  now: string
  scores: readonly AllocationScore[]
  deltas?: readonly AllocationDelta[]
}

export function generateCapitalDirectionMemo(input: CapitalDirectionInput): ChiefOfStaffOutput {
  const investMore = input.scores.filter((s) => s.recommendation === 'invest-more')
  const restructure = input.scores.filter((s) => s.recommendation === 'restructure')
  const pauseExit = input.scores.filter(
    (s) => s.recommendation === 'pause' || s.recommendation === 'exit',
  )

  const lines: string[] = []

  lines.push('### Where to lean in')
  if (investMore.length === 0) {
    lines.push('- No ventures earning `invest-more` this cycle. Don\'t force it — hold and improve.')
  } else {
    for (const s of investMore)
      lines.push(`- **${s.ventureSlug}** (composite ${s.composite}/100) — ${s.reasons[0] ?? 'all axes strong.'}`)
  }

  lines.push('', '### Where to restructure')
  if (restructure.length === 0) lines.push('- Nothing flagged restructure.')
  else
    for (const s of restructure)
      lines.push(`- **${s.ventureSlug}** (${s.composite}/100) — ${s.reasons[0] ?? 'composite below hold band.'}`)

  lines.push('', '### Where to pause / exit')
  if (pauseExit.length === 0) lines.push('- Nothing flagged pause or exit.')
  else
    for (const s of pauseExit)
      lines.push(`- **${s.ventureSlug}** (${s.composite}/100, ${s.recommendation}) — ${s.reasons[0] ?? 'composite below restructure band.'}`)

  if (input.deltas && input.deltas.length > 0) {
    const movers = input.deltas.filter((d) => d.recommendationChanged)
    if (movers.length > 0) {
      lines.push('', '### Recommendation changes since last review')
      for (const d of movers)
        lines.push(
          `- **${d.ventureSlug}** — ${d.recommendationBefore ?? 'new'} → ${d.recommendationAfter} (${d.headline})`,
        )
    }
  }

  const summary = `${investMore.length} invest-more · ${restructure.length} restructure · ${pauseExit.length} pause/exit.`
  const markdown = `# Capital Direction Memo — ${input.now.slice(0, 10)}\n\n> ${summary}\n\n${lines.join('\n')}\n`

  return {
    generatedAt: input.now,
    title: `Capital Direction Memo — ${input.now.slice(0, 10)}`,
    summary,
    bullets: lines,
    markdown,
  }
}
