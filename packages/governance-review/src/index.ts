/**
 * @nzila/governance-review
 *
 * Pure primitives for executive governance review workflows. Holds the
 * canonical workflow registry, the deterministic decision shape, and
 * an append-only in-memory decision recorder. Persistence is a host
 * concern.
 */
import { z } from 'zod'

export const REVIEW_WORKFLOWS = [
  'deployment-review',
  'continuity-review',
  'governance-posture-review',
  'modernization-readiness-review',
  'pilot-readiness-review',
  'ai-governance-review',
  'operational-legitimacy-review',
] as const
export type ReviewWorkflow = (typeof REVIEW_WORKFLOWS)[number]

export const REVIEW_DECISIONS = [
  'acknowledge',
  'request_clarification',
  'approve_with_conditions',
  'reject',
] as const
export type ReviewDecisionKind = (typeof REVIEW_DECISIONS)[number]

export const reviewDecisionSchema = z
  .object({
    workflow: z.enum(REVIEW_WORKFLOWS),
    decision: z.enum(REVIEW_DECISIONS),
    decidedAt: z.string().datetime(),
    /** Stable reviewer role identifier, never a person identifier. */
    reviewerRole: z.string().min(1),
    citedDoctrine: z.array(z.string().min(1)).min(1),
    rationale: z.string().min(1).max(560),
    conditions: z.array(z.string().min(1)).optional(),
    supersedes: z.string().optional(),
    /** Decision identifier — content-derived, supplied by the host. */
    id: z.string().min(1),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.decision === 'approve_with_conditions' && (!d.conditions || d.conditions.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'approve_with_conditions_requires_conditions',
      })
    }
    if (d.decision === 'reject' && !d.rationale) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reject_requires_cited_rationale' })
    }
  })

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>

/**
 * Append-only decision ledger. Refuses any update to an existing entry;
 * supersession is the only correction mechanism.
 */
export class DecisionLedger {
  private readonly entries: ReviewDecision[] = []

  record(decision: ReviewDecision): ReviewDecision {
    const parsed = reviewDecisionSchema.parse(decision)
    if (this.entries.some((e) => e.id === parsed.id)) {
      throw new Error('decision_ledger_is_append_only')
    }
    if (parsed.supersedes && !this.entries.some((e) => e.id === parsed.supersedes)) {
      throw new Error('supersedes_unknown_decision')
    }
    this.entries.push(parsed)
    return parsed
  }

  list(workflow?: ReviewWorkflow): readonly ReviewDecision[] {
    return workflow ? this.entries.filter((e) => e.workflow === workflow) : [...this.entries]
  }

  /**
   * Resolve the effective (most recent non-superseded) decision per id.
   */
  effective(workflow: ReviewWorkflow): readonly ReviewDecision[] {
    const superseded = new Set(
      this.entries.filter((e) => e.supersedes).map((e) => e.supersedes!),
    )
    return this.entries.filter(
      (e) => e.workflow === workflow && !superseded.has(e.id),
    )
  }
}

export interface QueueItem {
  readonly id: string
  readonly workflow: ReviewWorkflow
  readonly enqueuedAt: string
  readonly summary: string
  readonly citedDoctrine: readonly string[]
}

/**
 * Build a sparse single-channel review queue. Sorted oldest-first so
 * the queue never feels stale; capped at `maxItems` to refuse
 * escalation flooding.
 */
export function buildReviewQueue(
  items: readonly QueueItem[],
  maxItems = 25,
): readonly QueueItem[] {
  return [...items]
    .sort((a, b) => (a.enqueuedAt < b.enqueuedAt ? -1 : 1))
    .slice(0, maxItems)
}
