/**
 * Dependency 2.0 — Phase 5+.
 *
 * Builds on `computeDependencyScore` to produce **delegation moves** — concrete
 * recommendations the founder can act on this week to lower bottleneck score.
 *
 * A move is one of:
 *   - assign a second owner to a venture missing one,
 *   - reassign a specific founder-owned task to its venture's second owner,
 *   - schedule a relationship handover on a contact the founder solely owns.
 *
 * Pure functions, no I/O. Deterministic ordering: highest impact first.
 */
import type { Contact, DependencyScore, Task, Venture } from './types'

export type DelegationMoveKind =
  | 'assign-second-owner'
  | 'reassign-task'
  | 'introduce-relationship'

export interface DelegationMove {
  kind: DelegationMoveKind
  ventureSlug: string
  /** ID of the entity being moved (task id, contact id, venture id). */
  targetId: string
  targetLabel: string
  /** Estimated dependency-score reduction if this move is executed. */
  estimatedScoreReduction: number
  rationale: string
  /** Optional suggested assignee user id, if known. */
  suggestedAssigneeUserId: string | null
}

export interface DependencyMovesInput {
  founderUserId: string
  ventures: readonly Venture[]
  tasks: readonly Task[]
  contacts: readonly Contact[]
  scores: readonly DependencyScore[]
}

export function recommendDelegationMoves(
  input: DependencyMovesInput,
): DelegationMove[] {
  const { founderUserId, ventures, tasks, contacts, scores } = input
  const moves: DelegationMove[] = []
  const scoreBySlug = new Map(scores.map((s) => [s.ventureSlug, s]))

  for (const v of ventures) {
    if (v.stage === 'sunset') continue
    const score = scoreBySlug.get(v.slug)
    if (!score) continue

    // Move 1: assign second owner — biggest single lever (worth ~15 pts).
    if (v.secondOwnerUserId == null) {
      moves.push({
        kind: 'assign-second-owner',
        ventureSlug: v.slug,
        targetId: v.id,
        targetLabel: v.name,
        estimatedScoreReduction: 15,
        rationale: `${v.name} has no second owner — this is the single biggest dependency lever.`,
        suggestedAssigneeUserId: null,
      })
    }

    // Move 2: reassign founder-owned tasks. Each task is roughly worth
    //         (weight 25) / (open tasks count). We surface up to 3 per venture.
    const openVentureTasks = tasks.filter(
      (t) => t.ventureSlug === v.slug && t.status !== 'done',
    )
    const founderTasks = openVentureTasks.filter((t) => t.ownerUserId === founderUserId)
    if (founderTasks.length > 0 && openVentureTasks.length > 0) {
      const perTaskImpact = Math.max(1, Math.round(25 / openVentureTasks.length))
      const ranked = [...founderTasks].sort((a, b) => urgencyRank(b) - urgencyRank(a)).slice(0, 3)
      for (const t of ranked) {
        moves.push({
          kind: 'reassign-task',
          ventureSlug: v.slug,
          targetId: t.id,
          targetLabel: t.title,
          estimatedScoreReduction: perTaskImpact,
          rationale: `Founder-owned ${t.queue} task on ${v.name}${t.dueAt ? `, due ${t.dueAt.slice(0, 10)}` : ''}.`,
          suggestedAssigneeUserId: v.secondOwnerUserId ?? null,
        })
      }
    }

    // Move 3: introduce relationships. Pick contacts the founder solely owns
    //         (no warm-intro path), top 2.
    const soleContacts = contacts.filter(
      (c) => c.ownerUserId === founderUserId && c.warmIntroPath.length === 0,
    )
    const top2 = soleContacts.slice(0, 2)
    for (const c of top2) {
      moves.push({
        kind: 'introduce-relationship',
        ventureSlug: v.slug,
        targetId: c.id,
        targetLabel: c.fullName,
        estimatedScoreReduction: 5,
        rationale: `Single point of failure on ${c.fullName} — founder is sole relationship owner.`,
        suggestedAssigneeUserId: v.secondOwnerUserId ?? null,
      })
    }
  }

  return moves.sort((a, b) => b.estimatedScoreReduction - a.estimatedScoreReduction)
}

function urgencyRank(t: Task): number {
  // Pure ordering: earlier (or missing) due dates rank lower so the sort
  // (descending by rank) surfaces overdue first. We use a large constant for
  // null due dates so they fall to the back without I/O.
  if (t.dueAt == null) return 0
  // ISO timestamps sort lexicographically; invert so earlier => higher rank.
  // Use the parsed numeric form normalized to days against a fixed epoch
  // (year 2000) so the value stays in a small integer range and is deterministic.
  const epoch = Date.UTC(2000, 0, 1)
  const days = Math.floor((Date.parse(t.dueAt) - epoch) / 86_400_000)
  // Return a high-for-near, low-for-far signal, capped to keep the sort stable.
  return Math.max(0, 100_000 - days)
}
