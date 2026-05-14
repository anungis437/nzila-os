/**
 * Governance — Protected Semantics Fence
 *
 * Defines the IGG kinds and event categories that MUST NOT appear in any
 * read surface intended for non-internal consumers. The substrate captures
 * these for chain-of-custody and audit purposes; this fence guarantees
 * they are not surfaced through governance queries, dashboards, or
 * adapter-derived projections returned to UI/API consumers.
 *
 * Protected categories per Phase 3 architecture audit:
 *   - Class B special voting share existence and provenance
 *   - Golden share sunset progression telemetry
 *   - Class B veto events
 *   - Reserved matter mechanics
 *   - Continuity / founder protection structures
 *
 * The fence is a derivation rule, not an access-control system. It is the
 * package's contract to its callers: anything passed through `redactProtected`
 * is safe to expose; anything matched by `isProtectedKind` /
 * `isProtectedEventKind` was filtered out.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import { IggEntityKinds, IggEventKinds, IggRelationshipKinds } from '../ontology/kinds'

/** Entity kinds whose existence is itself protected. */
export const IGG_PROTECTED_ENTITY_KINDS: readonly string[] = Object.freeze([
  IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE,
  IggEntityKinds.RESERVED_MATTER,
])

/** Relationship kinds whose existence is itself protected. */
export const IGG_PROTECTED_RELATIONSHIP_KINDS: readonly string[] = Object.freeze([
  IggRelationshipKinds.VETOES,
  IggRelationshipKinds.HOLDS,
  IggRelationshipKinds.OVERRIDES,
])

/** Event/decision categories that must not appear in read surfaces. */
export const IGG_PROTECTED_EVENT_KINDS: readonly string[] = Object.freeze([
  IggEventKinds.CLASS_B_VETO,
  IggEventKinds.GOLDEN_SHARE_SUNSET_PROGRESSION,
  IggEventKinds.RESERVED_MATTER_RAISED,
])

/** Decision categories sourced by the mapper that must not appear publicly. */
export const IGG_PROTECTED_DECISION_CATEGORIES: readonly string[] = Object.freeze([
  'class_b_veto',
  'reserved_matter_vote',
])

export function isProtectedEntityKind(kind: string | undefined): boolean {
  return !!kind && IGG_PROTECTED_ENTITY_KINDS.includes(kind)
}

export function isProtectedRelationshipKind(kind: string | undefined): boolean {
  return !!kind && IGG_PROTECTED_RELATIONSHIP_KINDS.includes(kind)
}

export function isProtectedEventKind(kind: string | undefined): boolean {
  return !!kind && IGG_PROTECTED_EVENT_KINDS.includes(kind)
}

function isProtectedDecision(decision: DecisionNode): boolean {
  const outcome = decision.outcome as Record<string, unknown> | undefined
  const category = outcome?.iggCategory as string | undefined
  const eventKind = outcome?.iggEventKind as string | undefined
  return (
    (!!category && IGG_PROTECTED_DECISION_CATEGORIES.includes(category)) ||
    isProtectedEventKind(eventKind)
  )
}

function entityIggKind(node: EntityNode): string | undefined {
  return (node.metadata as Record<string, unknown> | undefined)?.iggKind as
    | string
    | undefined
}

function edgeIggKind(edge: EntityEdge): string | undefined {
  return (edge.metadata as Record<string, unknown> | undefined)?.iggKind as
    | string
    | undefined
}

/**
 * Filter a node/edge/decision projection so that no protected semantics
 * remain. Returns a new object — does not mutate inputs.
 */
export function redactProtected<
  T extends {
    nodes?: readonly EntityNode[]
    edges?: readonly EntityEdge[]
    decisions?: readonly DecisionNode[]
  },
>(input: T): T {
  const nodes = input.nodes
    ? input.nodes.filter((n) => !isProtectedEntityKind(entityIggKind(n)))
    : input.nodes
  const edges = input.edges
    ? input.edges.filter((e) => !isProtectedRelationshipKind(edgeIggKind(e)))
    : input.edges
  const decisions = input.decisions
    ? input.decisions.filter((d) => !isProtectedDecision(d))
    : input.decisions
  return { ...input, nodes, edges, decisions } as T
}

/**
 * Assertion helper for tests / dev-mode guards. Throws if any protected
 * semantics leak through a read surface.
 */
export function assertNoProtectedKindsInReadSurface(input: {
  nodes?: readonly EntityNode[]
  edges?: readonly EntityEdge[]
  decisions?: readonly DecisionNode[]
}): void {
  const leaks: string[] = []
  for (const n of input.nodes ?? []) {
    const kind = entityIggKind(n)
    if (isProtectedEntityKind(kind)) leaks.push(`entity:${n.entityId}:${kind}`)
  }
  for (const e of input.edges ?? []) {
    const kind = edgeIggKind(e)
    if (isProtectedRelationshipKind(kind)) leaks.push(`edge:${e.id}:${kind}`)
  }
  for (const d of input.decisions ?? []) {
    if (isProtectedDecision(d)) leaks.push(`decision:${d.id}`)
  }
  if (leaks.length > 0) {
    throw new Error(
      `Protected governance semantics leaked into read surface: ${leaks.join(', ')}`,
    )
  }
}

// ── Projection-level (Phase 4) fence ───────────────────────────────────────

/**
 * Minimal shape every Phase 4 projection entry exposes. The guard inspects
 * `category`, `kind`, and `summary` for any reference to a protected
 * decision category or protected event kind.
 *
 * Projection types covered (additive — no coupling to specific modules):
 *   - InstitutionalTimelineEntry  (timeline.ts)
 *   - EvidenceConvergenceEntry    (evidence.ts)
 *   - ContinuityEntry             (continuity.ts)
 *   - SuccessionBreakpoint        (continuity.ts)
 */
export interface ProtectedProjectionScanFields {
  readonly category?: string | undefined
  readonly kind?: string | undefined
  readonly summary?: string | undefined
}

function isProtectedCategoryString(value: string): boolean {
  return (
    IGG_PROTECTED_DECISION_CATEGORIES.includes(value) ||
    IGG_PROTECTED_EVENT_KINDS.includes(value)
  )
}

/**
 * Defensive output-surface guard (Phase 4). Throws if any projection entry
 * references a protected decision category or protected event kind via its
 * `category`, `kind`, or `summary` field.
 *
 * This is layered ON TOP of `assertNoProtectedKindsInReadSurface` (which
 * inspects raw substrate). Together they cover both the inputs and the
 * outputs of every public read surface.
 */
export function assertNoProtectedKindsInProjections(
  entries: readonly ProtectedProjectionScanFields[],
  context = 'projection',
): void {
  const leaks: string[] = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!e) continue
    const cat = e.category
    if (cat && isProtectedCategoryString(cat)) {
      leaks.push(`${context}[${i}].category=${cat}`)
    }
    const k = e.kind
    if (k && isProtectedEventKind(k)) {
      leaks.push(`${context}[${i}].kind=${k}`)
    }
    const summary = e.summary
    if (summary) {
      for (const protectedKind of IGG_PROTECTED_EVENT_KINDS) {
        if (summary.includes(protectedKind)) {
          leaks.push(`${context}[${i}].summary references ${protectedKind}`)
          break
        }
      }
      for (const protectedCategory of IGG_PROTECTED_DECISION_CATEGORIES) {
        if (summary.includes(protectedCategory)) {
          leaks.push(`${context}[${i}].summary references ${protectedCategory}`)
          break
        }
      }
    }
  }
  if (leaks.length > 0) {
    throw new Error(
      `Protected governance semantics leaked into projection entries: ${leaks.join(', ')}`,
    )
  }
}

/**
 * Filter projection entries, dropping any that reference a protected
 * category, kind, or summary token. Returned array preserves order.
 *
 * Prefer wiring `assertNoProtectedKindsInProjections` at the end of the
 * public builder instead — silent stripping should be the exception, not
 * the rule. This helper exists for adapter code that joins multiple read
 * surfaces and wants a final defensive pass.
 */
export function redactProtectedFromProjections<T extends ProtectedProjectionScanFields>(
  entries: readonly T[],
): readonly T[] {
  return entries.filter((e) => {
    if (e.category && isProtectedCategoryString(e.category)) return false
    if (e.kind && isProtectedEventKind(e.kind)) return false
    if (e.summary) {
      for (const k of IGG_PROTECTED_EVENT_KINDS) {
        if (e.summary.includes(k)) return false
      }
      for (const c of IGG_PROTECTED_DECISION_CATEGORIES) {
        if (e.summary.includes(c)) return false
      }
    }
    return true
  })
}
