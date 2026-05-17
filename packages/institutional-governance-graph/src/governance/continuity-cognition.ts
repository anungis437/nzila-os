/**
 * Governance — Continuity Cognition (Wave 3)
 *
 * Pure, read-only derivations OVER the Wave 2
 * `continuity-intelligence-foundations` outputs. These functions transform
 * already-redacted continuity primitives into **cognition refs** — counts,
 * chronology-ordered pathways, and entity-ref aggregations that downstream
 * surfaces can render without performing their own reasoning, scoring, or
 * persistence.
 *
 * Doctrine fence (mirrors Wave 2 foundations + IGG `protected.ts`):
 *   - No scoring, no ranking, no severity, no weighting.
 *   - No prediction, no automation, no intervention recommendation.
 *   - No persistence, no event sourcing, no orchestration.
 *   - Stewardship-flavoured wording only. Inputs MUST already be projected
 *     through the protected-fence; this module performs a defensive
 *     re-assertion on every callable boundary.
 *
 * Companion overlay: `apps/union-eyes/components/runtime-hydration/`
 * consumes these summaries in its `RuntimeCognitionOverlay`.
 */
import { assertNoProtectedKindsInProjections } from './protected'
import type {
  ContinuityBreakpoint,
  InstitutionalMemoryGap,
  LineageBreak,
  UnresolvedTransition,
} from './continuity-intelligence-foundations'

export const CONTINUITY_COGNITION_VERSION = '2026.05-wave3' as const

// ── Public summary types ─────────────────────────────────────────────────

export interface UnresolvedTransitionSummary {
  readonly totalCount: number
  readonly byKind: Readonly<Record<string, number>>
  readonly oldestOccurredAt?: string
  readonly newestOccurredAt?: string
}

export interface ContinuityBreakpointSummary {
  readonly totalCount: number
  readonly bracketedCount: number
  readonly unbracketedCount: number
}

export interface LineageBreakSummary {
  readonly totalCount: number
  readonly byReason: Readonly<Record<LineageBreak['reason'], number>>
}

export interface InstitutionalMemoryGapSummary {
  readonly totalCount: number
  readonly missingEvidenceCount: number
  readonly missingKnowledgeCount: number
  readonly missingPolicyCount: number
}

export interface SuccessionPathwayStep {
  readonly edgeId: string
  readonly predecessorEntityId: string
  readonly successorEntityId: string
  readonly occurredAt: string
  readonly bracketedByInstitutionalMemory: boolean
}

export interface ProceduralFragilityRef {
  readonly entityRef: string
  /** Which substrate signals reference this entity. Pure presence — no score. */
  readonly signals: ReadonlyArray<
    'unresolved_transition' | 'institutional_memory_gap' | 'lineage_break'
  >
}

// ── Pure summaries ───────────────────────────────────────────────────────

export function summarizeUnresolvedTransitions(
  unresolved: readonly UnresolvedTransition[],
): UnresolvedTransitionSummary {
  // Defensive re-assertion: the upstream foundations module already asserts,
  // but the cognition layer treats every input as untrusted at its boundary.
  for (const u of unresolved) {
    assertNoProtectedKindsInProjections(
      [{ kind: u.kind }],
      'continuity-cognition.unresolvedTransitions',
    )
  }
  const byKind: Record<string, number> = {}
  let oldest: string | undefined
  let newest: string | undefined
  for (const u of unresolved) {
    byKind[u.kind] = (byKind[u.kind] ?? 0) + 1
    if (!oldest || u.openedAt < oldest) oldest = u.openedAt
    if (!newest || u.openedAt > newest) newest = u.openedAt
  }
  return Object.freeze({
    totalCount: unresolved.length,
    byKind: Object.freeze(byKind),
    oldestOccurredAt: oldest,
    newestOccurredAt: newest,
  })
}

export function summarizeContinuityBreakpoints(
  breakpoints: readonly ContinuityBreakpoint[],
): ContinuityBreakpointSummary {
  let bracketed = 0
  for (const b of breakpoints) {
    if (b.hasInstitutionalMemoryRef) bracketed += 1
  }
  return Object.freeze({
    totalCount: breakpoints.length,
    bracketedCount: bracketed,
    unbracketedCount: breakpoints.length - bracketed,
  })
}

export function summarizeLineageBreaks(
  lineageBreaks: readonly LineageBreak[],
): LineageBreakSummary {
  const byReason: Record<LineageBreak['reason'], number> = {
    no_shared_cohort: 0,
    no_predecessor_record: 0,
    no_successor_record: 0,
  }
  for (const l of lineageBreaks) {
    byReason[l.reason] += 1
  }
  return Object.freeze({
    totalCount: lineageBreaks.length,
    byReason: Object.freeze(byReason),
  })
}

export function summarizeInstitutionalMemoryGaps(
  gaps: readonly InstitutionalMemoryGap[],
): InstitutionalMemoryGapSummary {
  let evidence = 0
  let knowledge = 0
  let policy = 0
  for (const g of gaps) {
    for (const m of g.missing) {
      if (m === 'evidence') evidence += 1
      else if (m === 'knowledge') knowledge += 1
      else if (m === 'policy') policy += 1
    }
  }
  return Object.freeze({
    totalCount: gaps.length,
    missingEvidenceCount: evidence,
    missingKnowledgeCount: knowledge,
    missingPolicyCount: policy,
  })
}

/**
 * Chronology-linked succession visibility. Returns the supplied continuity
 * breakpoints ordered by `occurredAt` ascending, each annotated with whether
 * an institutional-memory reference brackets it. No scoring; pure structural
 * succession visibility.
 */
export function deriveSuccessionPathway(
  breakpoints: readonly ContinuityBreakpoint[],
): readonly SuccessionPathwayStep[] {
  const ordered = [...breakpoints].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
  )
  const out: SuccessionPathwayStep[] = ordered.map((b) => ({
    edgeId: b.edgeId,
    predecessorEntityId: b.predecessorEntityId,
    successorEntityId: b.successorEntityId,
    occurredAt: b.occurredAt,
    bracketedByInstitutionalMemory: b.hasInstitutionalMemoryRef,
  }))
  return Object.freeze(out)
}

/**
 * Procedural fragility visibility — surfaces entity refs that appear in at
 * least two of the three substrate-fragility signals (unresolved transition,
 * institutional memory gap, lineage break). Pure structural co-occurrence.
 * Not a risk score. Not a recommendation. Not an alert.
 */
export function deriveProceduralFragilityRefs(
  unresolved: readonly UnresolvedTransition[],
  gaps: readonly InstitutionalMemoryGap[],
  lineageBreaks: readonly LineageBreak[],
): readonly ProceduralFragilityRef[] {
  const signalsByEntity = new Map<
    string,
    Set<'unresolved_transition' | 'institutional_memory_gap' | 'lineage_break'>
  >()
  const add = (
    entityRef: string,
    signal: 'unresolved_transition' | 'institutional_memory_gap' | 'lineage_break',
  ) => {
    let bucket = signalsByEntity.get(entityRef)
    if (!bucket) {
      bucket = new Set()
      signalsByEntity.set(entityRef, bucket)
    }
    bucket.add(signal)
  }
  for (const u of unresolved) add(u.entityRef, 'unresolved_transition')
  for (const g of gaps) add(g.entityRef, 'institutional_memory_gap')
  for (const l of lineageBreaks) {
    add(l.predecessorEntityId, 'lineage_break')
    add(l.successorEntityId, 'lineage_break')
  }
  const out: ProceduralFragilityRef[] = []
  for (const [entityRef, signals] of signalsByEntity) {
    if (signals.size < 2) continue
    out.push({
      entityRef,
      signals: Object.freeze(
        [...signals].sort() as Array<
          'unresolved_transition' | 'institutional_memory_gap' | 'lineage_break'
        >,
      ),
    })
  }
  out.sort((a, b) => (a.entityRef < b.entityRef ? -1 : a.entityRef > b.entityRef ? 1 : 0))
  return Object.freeze(out)
}
