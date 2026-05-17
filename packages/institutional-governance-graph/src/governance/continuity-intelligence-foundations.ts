/**
 * Governance — Continuity Intelligence Foundations (Workstream M preparation)
 *
 * Wave 2 substrate scaffolding. This module defines the read-only contract
 * types that future Workstream M ("Continuity Intelligence") will hydrate.
 * It SHIPS ONLY TYPES + pure derivations from already-redacted continuity
 * inputs — no IO, no scoring, no prediction, no autonomous reasoning.
 *
 * Doctrine fence:
 *   - This module is read-only and governance-safe.
 *   - All inputs MUST already have passed `redactProtected` /
 *     `assertNoProtectedKindsInProjections`.
 *   - No ranking. No weighting. No "fragility scoring". No predictive labels.
 *   - All derivations are stewardship-flavoured: they expose where continuity
 *     is unresolved, broken, or undocumented — NEVER a governance verdict.
 *
 * Companion overlay: `apps/union-eyes/components/runtime-hydration/` consumes
 * these reference types in its `RuntimeContinuityOverlay`.
 */
import type {
  ContinuityEntry,
  SuccessionBreakpoint,
} from './continuity'
import { assertNoProtectedKindsInProjections } from './protected'

// ── Public types ─────────────────────────────────────────────────────────

/**
 * A continuity transition (role tenure event, affiliation transition, steward
 * assignment, CBA ratification) that has NO matching closing/successor entry
 * in the supplied continuity entries window. Surfaced to stewards as
 * "context-pending"; never as a governance recommendation.
 */
export interface UnresolvedTransition {
  readonly entityRef: string
  readonly openedAt: string
  readonly openingDecisionId?: string
  readonly kind: ContinuityEntry['kind']
  readonly summary: string
}

/**
 * A succession breakpoint (derived upstream from a SUPERSEDES edge) that is
 * not yet bracketed by a corresponding institutional memory entry. Surfaced
 * to reviewers as "lineage break under review".
 */
export interface ContinuityBreakpoint {
  readonly edgeId: string
  readonly predecessorEntityId: string
  readonly successorEntityId: string
  readonly occurredAt: string
  readonly hasInstitutionalMemoryRef: boolean
}

/**
 * A lineage discontinuity: a succession breakpoint whose predecessor and
 * successor do not share continuity cohort metadata. Stewardship signal
 * only — no scoring, no severity.
 */
export interface LineageBreak {
  readonly edgeId: string
  readonly predecessorEntityId: string
  readonly successorEntityId: string
  readonly occurredAt: string
  readonly reason: 'no_shared_cohort' | 'no_predecessor_record' | 'no_successor_record'
}

/**
 * A gap in the institutional memory record — i.e. a continuity entry whose
 * referenced entity has no corresponding evidence/knowledge/policy reference
 * attached in the upstream evidence convergence layer.
 */
export interface InstitutionalMemoryGap {
  readonly entityRef: string
  readonly occurredAt: string
  readonly missing: ReadonlyArray<'evidence' | 'knowledge' | 'policy'>
  readonly summary: string
}

// ── Pure, read-only derivations ──────────────────────────────────────────

/**
 * Find continuity entries that opened a transition (role_tenure_event,
 * affiliation_transition, steward_assignment) but have no later closing entry
 * on the same entity in the supplied window.
 *
 * Inputs MUST be the output of `buildContinuityTimeline` (already
 * protected-fence-safe).
 */
export function deriveUnresolvedTransitions(
  entries: readonly ContinuityEntry[],
): readonly UnresolvedTransition[] {
  assertNoProtectedKindsInProjections(entries, 'continuity-intelligence-foundations.entries')

  const seenClose = new Set<string>()
  const opens: ContinuityEntry[] = []
  for (const e of entries) {
    if (e.kind === 'succession_breakpoint' || e.kind === 'cba_ratified') continue
    if (e.status === 'closed' || e.status === 'completed') {
      seenClose.add(e.entityRef)
    } else {
      opens.push(e)
    }
  }
  const out: UnresolvedTransition[] = []
  for (const e of opens) {
    if (seenClose.has(e.entityRef)) continue
    out.push({
      entityRef: e.entityRef,
      openedAt: e.occurredAt,
      openingDecisionId: e.decisionId,
      kind: e.kind,
      summary: e.summary,
    })
  }
  return Object.freeze(out)
}

/**
 * Mark each succession breakpoint with whether the supplied institutional
 * memory entity ref set contains a record bracketing it.
 */
export function deriveContinuityBreakpoints(
  breakpoints: readonly SuccessionBreakpoint[],
  institutionalMemoryEntityRefs: ReadonlySet<string>,
): readonly ContinuityBreakpoint[] {
  const out: ContinuityBreakpoint[] = []
  for (const b of breakpoints) {
    out.push({
      edgeId: b.edgeId,
      predecessorEntityId: b.predecessorEntityId,
      successorEntityId: b.successorEntityId,
      occurredAt: b.occurredAt,
      hasInstitutionalMemoryRef:
        institutionalMemoryEntityRefs.has(b.predecessorEntityId) ||
        institutionalMemoryEntityRefs.has(b.successorEntityId),
    })
  }
  return Object.freeze(out)
}

/**
 * Detect lineage breaks: succession breakpoints whose predecessor and
 * successor do not share any continuity cohort reference.
 *
 * `cohortsByEntityId` MUST be the redacted cohort projection from
 * `continuityCohort` — no protected ancestry / class-B / reserved-matter
 * edges allowed.
 */
export function deriveLineageBreaks(
  breakpoints: readonly SuccessionBreakpoint[],
  cohortsByEntityId: ReadonlyMap<string, ReadonlySet<string>>,
): readonly LineageBreak[] {
  const out: LineageBreak[] = []
  for (const b of breakpoints) {
    const pre = cohortsByEntityId.get(b.predecessorEntityId)
    const post = cohortsByEntityId.get(b.successorEntityId)
    if (!pre) {
      out.push({
        edgeId: b.edgeId,
        predecessorEntityId: b.predecessorEntityId,
        successorEntityId: b.successorEntityId,
        occurredAt: b.occurredAt,
        reason: 'no_predecessor_record',
      })
      continue
    }
    if (!post) {
      out.push({
        edgeId: b.edgeId,
        predecessorEntityId: b.predecessorEntityId,
        successorEntityId: b.successorEntityId,
        occurredAt: b.occurredAt,
        reason: 'no_successor_record',
      })
      continue
    }
    let shared = false
    for (const c of pre) {
      if (post.has(c)) {
        shared = true
        break
      }
    }
    if (!shared) {
      out.push({
        edgeId: b.edgeId,
        predecessorEntityId: b.predecessorEntityId,
        successorEntityId: b.successorEntityId,
        occurredAt: b.occurredAt,
        reason: 'no_shared_cohort',
      })
    }
  }
  return Object.freeze(out)
}

/**
 * For each continuity entry, report which evidence categories are missing
 * (relative to the supplied evidence-refs-by-entity map). Stewardship signal
 * only.
 */
export function deriveInstitutionalMemoryGaps(
  entries: readonly ContinuityEntry[],
  evidenceByEntityId: ReadonlyMap<
    string,
    {
      readonly evidence: ReadonlySet<string>
      readonly knowledge: ReadonlySet<string>
      readonly policy: ReadonlySet<string>
    }
  >,
): readonly InstitutionalMemoryGap[] {
  assertNoProtectedKindsInProjections(entries, 'continuity-intelligence-foundations.entries')
  const out: InstitutionalMemoryGap[] = []
  for (const e of entries) {
    if (e.kind === 'succession_breakpoint') continue
    const bucket = evidenceByEntityId.get(e.entityRef)
    const missing: Array<'evidence' | 'knowledge' | 'policy'> = []
    if (!bucket || bucket.evidence.size === 0) missing.push('evidence')
    if (!bucket || bucket.knowledge.size === 0) missing.push('knowledge')
    if (!bucket || bucket.policy.size === 0) missing.push('policy')
    if (missing.length === 0) continue
    out.push({
      entityRef: e.entityRef,
      occurredAt: e.occurredAt,
      missing: Object.freeze(missing),
      summary: e.summary,
    })
  }
  return Object.freeze(out)
}

/**
 * Stable contract version of this scaffolding. Workstream M will bump this
 * when it lands the hydrated implementation.
 */
export const CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION = '2026.05-wave2-scaffold'
