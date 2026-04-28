/**
 * Founder Dependency Engine (Phase 5).
 *
 * Computes a per-venture dependency score on a 0..100 scale where higher means
 * the venture is *more* dependent on the founder. Inputs are deterministic
 * snapshots of ventures, opportunities, tasks, contacts. No I/O.
 *
 * Signal mapping:
 *   0 ..  39 → green
 *  40 ..  69 → amber
 *  70 .. 100 → red
 */
import type { Contact, DependencyScore, HealthSignal, Opportunity, Task, Venture } from './types'

export interface DependencyEngineInput {
  founderUserId: string
  ventures: Venture[]
  opportunities: Opportunity[]
  tasks: Task[]
  contacts: Contact[]
  /** ISO timestamp used as `computedAt`. Inject for determinism. */
  now: string
}

interface SignalContribution {
  /** Weight in points out of 100. */
  weight: number
  /** Raw 0..1 score for this signal. */
  raw: number
  reason: string | null
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function classify(score: number): HealthSignal {
  if (score >= 70) return 'red'
  if (score >= 40) return 'amber'
  return 'green'
}

export function computeDependencyScore(
  venture: Venture,
  input: DependencyEngineInput,
): DependencyScore {
  const { founderUserId, opportunities, tasks, contacts, now } = input

  const ventureOpps = opportunities.filter((o) => o.ventureSlug === venture.slug)
  const ventureTasks = tasks.filter((t) => t.ventureSlug === venture.slug && t.status !== 'done')
  const ventureContacts = contacts.filter(
    (c) =>
      // Heuristic: contacts that map to organizations that mark this venture as relevant.
      // Without orgs in scope here we approximate by matching contact owners.
      c.ownerUserId === founderUserId || c.warmIntroPath.includes(founderUserId),
  )

  // Signal 1: founder owns share of open tasks (weight 25)
  const taskShare =
    ventureTasks.length === 0
      ? 0
      : ventureTasks.filter((t) => t.ownerUserId === founderUserId).length / ventureTasks.length
  const s1: SignalContribution = {
    weight: 25,
    raw: clamp01(taskShare),
    reason: taskShare >= 0.6 ? `Founder owns ${Math.round(taskShare * 100)}% of open tasks` : null,
  }

  // Signal 2: founder is sole second-owner on the venture (weight 15)
  const s2: SignalContribution = {
    weight: 15,
    raw: venture.secondOwnerUserId == null ? 1 : 0,
    reason: venture.secondOwnerUserId == null ? 'No second owner assigned to venture' : null,
  }

  // Signal 3: founder-touch-required deals share of pipeline (weight 25)
  const founderTouchValue = ventureOpps
    .filter((o) => o.founderTouchRequired)
    .reduce((sum, o) => sum + o.estimatedValueCents, 0)
  const totalPipelineValue = ventureOpps.reduce((sum, o) => sum + o.estimatedValueCents, 0)
  const founderTouchShare = totalPipelineValue === 0 ? 0 : founderTouchValue / totalPipelineValue
  const s3: SignalContribution = {
    weight: 25,
    raw: clamp01(founderTouchShare),
    reason:
      founderTouchShare >= 0.5
        ? `${Math.round(founderTouchShare * 100)}% of pipeline value flagged founder-touch`
        : null,
  }

  // Signal 4: founder is sole relationship owner on key contacts (weight 15)
  const founderOnlyContacts = ventureContacts.filter(
    (c) => c.ownerUserId === founderUserId && c.warmIntroPath.length === 0,
  ).length
  const contactRatio =
    ventureContacts.length === 0 ? 0 : founderOnlyContacts / ventureContacts.length
  const s4: SignalContribution = {
    weight: 15,
    raw: clamp01(contactRatio),
    reason:
      contactRatio >= 0.5
        ? `Founder is sole owner on ${founderOnlyContacts} contact(s) with no documented backup`
        : null,
  }

  // Signal 5: undocumented relationship history — contacts with no last interaction (weight 10)
  const undocumented = ventureContacts.filter((c) => c.lastInteractionAt == null).length
  const undocRatio = ventureContacts.length === 0 ? 0 : undocumented / ventureContacts.length
  const s5: SignalContribution = {
    weight: 10,
    raw: clamp01(undocRatio),
    reason:
      undocRatio >= 0.4
        ? `${undocumented} contact(s) lack interaction history (knowledge in founder's head)`
        : null,
  }

  // Signal 6: revenue concentration on founder-led deals — proxied by founder-touch on closed-won
  // not modeled here; additive signal kept simple (weight 10). Use blockers list as proxy.
  const blockerHit = venture.blockers.some((b) => /founder|ceo|approval/i.test(b))
  const s6: SignalContribution = {
    weight: 10,
    raw: blockerHit ? 1 : 0,
    reason: blockerHit ? 'Active blocker explicitly waiting on founder' : null,
  }

  const signals = [s1, s2, s3, s4, s5, s6]
  const weightedTotal = signals.reduce((sum, s) => sum + s.raw * s.weight, 0)
  const score = Math.round(weightedTotal)
  const reasons = signals.flatMap((s) => (s.reason ? [s.reason] : []))

  return {
    ventureSlug: venture.slug,
    score,
    signal: classify(score),
    reasons,
    computedAt: now,
  }
}

export function computeAllDependencyScores(input: DependencyEngineInput): DependencyScore[] {
  return input.ventures.map((v) => computeDependencyScore(v, input))
}

/**
 * Studio-level founder bottleneck score: weighted average of per-venture scores
 * weighted by MRR + pipeline (so higher-value ventures dominate).
 */
export function computeFounderBottleneckScore(
  scores: DependencyScore[],
  ventures: Venture[],
): { score: number; signal: HealthSignal } {
  if (scores.length === 0) return { score: 0, signal: 'green' }
  const ventureBySlug = new Map(ventures.map((v) => [v.slug, v]))
  let weightSum = 0
  let weighted = 0
  for (const s of scores) {
    const v = ventureBySlug.get(s.ventureSlug)
    if (!v) continue
    const weight = Math.max(1, v.monthlyRecurringRevenueCents + v.weightedPipelineCents / 12)
    weighted += s.score * weight
    weightSum += weight
  }
  const score = weightSum === 0 ? 0 : Math.round(weighted / weightSum)
  return { score, signal: classify(score) }
}
