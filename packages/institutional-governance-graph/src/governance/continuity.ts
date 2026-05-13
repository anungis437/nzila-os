/**
 * Governance — Institutional Continuity (Phase 4 Deliverable #4)
 *
 * Read-only continuity layer. Answers the institutional-history question:
 *
 *   "How did representation, role tenure, affiliation, and entity lineage
 *    persist or transition across the governance record?"
 *
 * Composes existing primitives:
 *   - `lineageChain`            (entity succession via SUPERSEDES post-redaction)
 *   - `continuityCohort`        (org affiliation cohort)
 *   - `hierarchyAncestors` /
 *     `hierarchyDescendants`    (org-tree continuity context)
 *   - `orderDecisionsChronologically`
 *
 * Surfaces only the following non-protected continuity event kinds from
 * decisions: ROLE_TENURE_EVENT, AFFILIATION_TRANSITION, STEWARD_ASSIGNMENT,
 * CBA_RATIFIED. Surfaces succession breakpoints exclusively from
 * `SUPERSEDES` edges (OVERRIDES is in `IGG_PROTECTED_RELATIONSHIP_KINDS`
 * and is stripped by `redactProtected`).
 *
 * NOT a behavioural / influence / predictive surface. This module:
 *   - performs NO ranking, scoring, or weighting (no tenure-length scoring,
 *     no leadership-stability metrics, no succession prediction)
 *   - performs NO actor profiling or caucus reconstruction
 *   - exposes NO protected-mechanics decisions, edges, or events
 *
 * Pipeline (mirrors `./evidence.ts`):
 *   redactProtected → filter protected event-kind leakage → derive entries →
 *   sort chronologically → applyOptions → assertNoProtectedKindsInReadSurface
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'

import { IggEventKinds, IggRelationshipKinds } from '../ontology/kinds.js'
import { lineageChain, orderDecisionsChronologically } from './chronology.js'
import {
  assertNoProtectedKindsInProjections,
  assertNoProtectedKindsInReadSurface,
  isProtectedEventKind,
  redactProtected,
} from './protected.js'
import { continuityCohort } from './queries.js'

// ── Public types ──────────────────────────────────────────────────────────

export type ContinuityEntryKind =
  | 'role_tenure_event'
  | 'affiliation_transition'
  | 'steward_assignment'
  | 'cba_ratified'
  | 'succession_breakpoint'

/**
 * A single read-safe continuity entry. May represent either a continuity
 * decision (`decisionId` populated) or a succession breakpoint derived from
 * a SUPERSEDES edge (`predecessorEntityId` / `successorEntityId` populated).
 */
export interface ContinuityEntry {
  readonly occurredAt: string
  readonly kind: ContinuityEntryKind
  readonly entityRef: string
  readonly summary: string
  readonly decisionId?: string
  readonly edgeId?: string
  readonly predecessorEntityId?: string
  readonly successorEntityId?: string
  readonly category?: string
  readonly status?: string
}

/**
 * Succession breakpoint derived from a SUPERSEDES edge. By convention
 * (matching `lineageChain`): source supersedes target → target is the
 * predecessor and source is the successor.
 */
export interface SuccessionBreakpoint {
  readonly occurredAt: string
  readonly edgeId: string
  readonly predecessorEntityId: string
  readonly successorEntityId: string
}

/** Substrate slice consumed by continuity surfaces. */
export interface ContinuityGraph {
  readonly nodes?: readonly EntityNode[]
  readonly edges?: readonly EntityEdge[]
  readonly decisions?: readonly DecisionNode[]
}

/** Read-only filter options for continuity queries. */
export interface ContinuityOptions {
  readonly since?: string
  readonly until?: string
  /** Restrict to specific continuity entry kinds. */
  readonly kinds?: readonly ContinuityEntryKind[]
}

// ── Internal helpers ──────────────────────────────────────────────────────

/** Continuity-eligible (and explicitly non-protected) event kinds. */
const CONTINUITY_EVENT_KINDS: ReadonlyMap<string, ContinuityEntryKind> = new Map([
  [IggEventKinds.ROLE_TENURE_EVENT, 'role_tenure_event'],
  [IggEventKinds.AFFILIATION_TRANSITION, 'affiliation_transition'],
  [IggEventKinds.STEWARD_ASSIGNMENT, 'steward_assignment'],
  [IggEventKinds.CBA_RATIFIED, 'cba_ratified'],
] as const)

const EPOCH = new Date(0).toISOString()

function metaString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const v = metadata?.[key]
  return typeof v === 'string' ? v : undefined
}

function decisionCategory(d: DecisionNode): string | undefined {
  return metaString(d.outcome as Record<string, unknown> | undefined, 'iggCategory')
}

function decisionEventKind(d: DecisionNode): string | undefined {
  return metaString(d.outcome as Record<string, unknown> | undefined, 'iggEventKind')
}

function edgeKind(e: EntityEdge): string | undefined {
  return metaString(e.metadata as Record<string, unknown> | undefined, 'iggKind')
}

function edgeOccurredAt(e: EntityEdge): string {
  return metaString(e.metadata as Record<string, unknown> | undefined, 'occurredAt') ?? EPOCH
}

function decisionsToContinuityEntries(
  decisions: readonly DecisionNode[],
): ContinuityEntry[] {
  const ordered = orderDecisionsChronologically(decisions)
  const out: ContinuityEntry[] = []
  for (const d of ordered) {
    const eventKind = decisionEventKind(d)
    if (!eventKind) continue
    const kind = CONTINUITY_EVENT_KINDS.get(eventKind)
    if (!kind) continue
    out.push({
      occurredAt: d.executedAt ?? d.createdAt ?? EPOCH,
      kind,
      entityRef: d.entityId,
      summary: d.summary ?? `${kind}:${d.id}`,
      decisionId: d.id,
      category: decisionCategory(d),
      status: d.status,
    })
  }
  return out
}

function edgesToSuccessionBreakpoints(
  edges: readonly EntityEdge[],
): SuccessionBreakpoint[] {
  // OVERRIDES is in IGG_PROTECTED_RELATIONSHIP_KINDS and has been stripped
  // by redactProtected upstream; we therefore only walk SUPERSEDES here.
  const out: SuccessionBreakpoint[] = []
  for (const e of edges) {
    if (edgeKind(e) !== IggRelationshipKinds.SUPERSEDES) continue
    out.push({
      occurredAt: edgeOccurredAt(e),
      edgeId: e.id,
      predecessorEntityId: e.targetEntityId,
      successorEntityId: e.sourceEntityId,
    })
  }
  return out
}

function breakpointsToEntries(
  breakpoints: readonly SuccessionBreakpoint[],
): ContinuityEntry[] {
  return breakpoints.map<ContinuityEntry>((b) => ({
    occurredAt: b.occurredAt,
    kind: 'succession_breakpoint',
    entityRef: b.successorEntityId,
    summary: `${b.successorEntityId} supersedes ${b.predecessorEntityId}`,
    edgeId: b.edgeId,
    predecessorEntityId: b.predecessorEntityId,
    successorEntityId: b.successorEntityId,
  }))
}

function sortAscending(entries: readonly ContinuityEntry[]): readonly ContinuityEntry[] {
  return [...entries].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) {
      const ak = a.decisionId ?? a.edgeId ?? ''
      const bk = b.decisionId ?? b.edgeId ?? ''
      return ak.localeCompare(bk)
    }
    return a.occurredAt < b.occurredAt ? -1 : 1
  })
}

function applyOptions(
  entries: readonly ContinuityEntry[],
  options: ContinuityOptions | undefined,
): readonly ContinuityEntry[] {
  if (!options) return entries
  const { since, until, kinds } = options
  const allow = kinds && kinds.length > 0 ? new Set(kinds) : null
  return entries.filter((e) => {
    if (since && e.occurredAt < since) return false
    if (until && e.occurredAt > until) return false
    if (allow && !allow.has(e.kind)) return false
    return true
  })
}

// ── Public builders ───────────────────────────────────────────────────────

/**
 * Build the unified continuity timeline over the supplied graph. Always
 * returns a redacted, chronologically sorted, read-safe view that includes
 * both continuity decisions (role tenure, affiliation transitions, steward
 * assignments, CBA ratifications) and succession breakpoints (SUPERSEDES).
 */
export function buildContinuityTimeline(
  graph: ContinuityGraph,
  options?: ContinuityOptions,
): readonly ContinuityEntry[] {
  const safe = redactProtected(graph)
  const decisions = safe.decisions ?? []
  const cleanedDecisions = decisions.filter(
    (d) => !isProtectedEventKind(decisionEventKind(d)),
  )
  const decisionEntries = decisionsToContinuityEntries(cleanedDecisions)
  const breakpointEntries = breakpointsToEntries(
    edgesToSuccessionBreakpoints(safe.edges ?? []),
  )
  const sorted = sortAscending([...decisionEntries, ...breakpointEntries])
  const final = applyOptions(sorted, options)
  assertNoProtectedKindsInReadSurface({
    nodes: safe.nodes,
    edges: safe.edges,
    decisions: cleanedDecisions,
  })
  // Phase 4: projection-level fence — final defensive sweep on the
  // returned entries themselves.
  assertNoProtectedKindsInProjections(final, 'continuity')
  return final
}

/**
 * Read-safe succession breakpoints. Derived only from SUPERSEDES edges
 * (post-redaction); OVERRIDES is protected and never appears here.
 */
export function successionBreakpoints(
  graph: ContinuityGraph,
): readonly SuccessionBreakpoint[] {
  const safe = redactProtected(graph)
  const breakpoints = edgesToSuccessionBreakpoints(safe.edges ?? [])
  // Stable chronological sort, mirroring entry ordering.
  // Note: SuccessionBreakpoint exposes only edge/entity ids + timestamp,
  // so there are no projection fields (category/kind/summary) that could
  // leak protected semantics. Substrate redaction above is sufficient.
  return [...breakpoints].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.edgeId.localeCompare(b.edgeId)
    return a.occurredAt < b.occurredAt ? -1 : 1
  })
}

/**
 * Continuity timeline anchored to a single entity. Includes:
 *   - continuity decisions whose `entityId === entityRef`
 *   - succession breakpoints in which the entity participates as either
 *     predecessor or successor
 */
export function continuityForEntity(
  graph: ContinuityGraph,
  entityRef: string,
  options?: ContinuityOptions,
): readonly ContinuityEntry[] {
  return buildContinuityTimeline(graph, options).filter((e) => {
    if (e.entityRef === entityRef) return true
    if (e.kind !== 'succession_breakpoint') return false
    return (
      e.predecessorEntityId === entityRef || e.successorEntityId === entityRef
    )
  })
}

/**
 * Continuity timeline aggregated across an organization and the entities
 * affiliated with it (per `continuityCohort`). Read-only; no inference.
 */
export function continuityForOrganization(
  graph: ContinuityGraph,
  organizationId: string,
  options?: ContinuityOptions,
): readonly ContinuityEntry[] {
  const cohort = new Set<string>([
    organizationId,
    ...continuityCohort(organizationId, graph.edges ?? []),
  ])
  return buildContinuityTimeline(graph, options).filter((e) => {
    if (cohort.has(e.entityRef)) return true
    if (e.kind !== 'succession_breakpoint') return false
    return (
      (e.predecessorEntityId !== undefined && cohort.has(e.predecessorEntityId)) ||
      (e.successorEntityId !== undefined && cohort.has(e.successorEntityId))
    )
  })
}

/**
 * Read-safe lineage view for an entity. Thin wrapper over `lineageChain`
 * applied to the post-redaction edge set, returning oldest → newest entity
 * IDs. Emitted as a convenience for continuity consumers that need the raw
 * succession sequence without breakpoint metadata.
 */
export function continuityLineage(
  graph: ContinuityGraph,
  entityRef: string,
): readonly string[] {
  const safe = redactProtected(graph)
  return lineageChain(entityRef, safe.edges ?? [])
}
