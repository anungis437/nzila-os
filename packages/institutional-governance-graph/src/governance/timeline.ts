/**
 * Governance — Institutional Timeline (Phase 4)
 *
 * Read-only convergence layer that unifies decisions, affiliation
 * transitions, representation transitions, and governance lifecycle
 * events into a single chronological view.
 *
 * Doctrine reminder (Phase 4 audit §4):
 *   - Additive only; no mutation, no automation, no surveillance.
 *   - Answers "How did this institutional state emerge?" — never
 *     "How do we optimize governance behaviour?".
 *   - Protected semantics (Class B / golden share / reserved matter / vetoes
 *     / continuity-protection mechanics) MUST NOT appear on the read
 *     surface. Every public builder funnels through `redactProtected` and
 *     ends with `assertNoProtectedKindsInReadSurface` as a fail-fast guard.
 *
 * No predictive scoring, influence ranking, caucus inference, or
 * behavioural analytics live here — by design.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import { IggRelationshipKinds } from '../ontology/kinds'
import { lineageChain, orderDecisionsChronologically } from './chronology'
import {
  assertNoProtectedKindsInProjections,
  assertNoProtectedKindsInReadSurface,
  isProtectedEntityKind,
  isProtectedEventKind,
  isProtectedRelationshipKind,
  redactProtected,
} from './protected'
import { continuityCohort } from './queries'

// ── Types ──────────────────────────────────────────────────────────────────

export type InstitutionalTimelineEntryKind =
  | 'decision'
  | 'affiliation'
  | 'representation'
  | 'governance_event'
  | 'lineage'
  | 'epoch_marker'

export interface InstitutionalTimelineEntry {
  /** ISO-8601 timestamp the event occurred or became effective. */
  readonly occurredAt: string
  /** Coarse classification used for grouping/filtering on the read side. */
  readonly kind: InstitutionalTimelineEntryKind
  /** Entity (org/person/decision/document) the entry is anchored to. */
  readonly entityRef: string
  /** Stable identifier of the underlying source object (decision id / edge id / entity id). */
  readonly sourceId: string
  /** Short, neutral, descriptive label — never evaluative/predictive. */
  readonly summary: string
  /** Optional category (e.g. `motion_outcome`, `cba_ratification`, `affiliation_transition`). */
  readonly category?: string
  /** Optional evidence pack identifiers linked from the source decision. */
  readonly evidenceRefs?: readonly string[]
  /** Optional governance/decision status snapshot. */
  readonly status?: string
}

export interface InstitutionalTimelineGraph {
  readonly nodes: readonly EntityNode[]
  readonly edges: readonly EntityEdge[]
  readonly decisions: readonly DecisionNode[]
}

export interface InstitutionalTimelineOptions {
  /** Restrict to entries occurring at or after this ISO timestamp. */
  readonly since?: string
  /** Restrict to entries occurring at or before this ISO timestamp. */
  readonly until?: string
  /** Keep only the listed entry kinds. */
  readonly kinds?: readonly InstitutionalTimelineEntryKind[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function metaTimestamp(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata) return undefined
  const candidates = ['occurredAt', 'effectiveAt', 'startedAt', 'createdAt', 'recordedAt']
  for (const k of candidates) {
    const v = metadata[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

function metaString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const v = metadata?.[key]
  return typeof v === 'string' ? v : undefined
}

function edgeIggKind(e: EntityEdge): string | undefined {
  return metaString(e.metadata, 'iggKind')
}

function entityIggKind(n: EntityNode): string | undefined {
  return metaString(n.metadata, 'iggKind')
}

function decisionCategory(d: DecisionNode): string | undefined {
  return metaString(d.outcome as Record<string, unknown> | undefined, 'iggCategory')
}

function decisionEventKind(d: DecisionNode): string | undefined {
  return metaString(d.outcome as Record<string, unknown> | undefined, 'iggEventKind')
}

function applyOptions(
  entries: readonly InstitutionalTimelineEntry[],
  options: InstitutionalTimelineOptions | undefined,
): readonly InstitutionalTimelineEntry[] {
  if (!options) return entries
  const { since, until, kinds } = options
  return entries.filter((e) => {
    if (since && e.occurredAt < since) return false
    if (until && e.occurredAt > until) return false
    if (kinds && kinds.length > 0 && !kinds.includes(e.kind)) return false
    return true
  })
}

function sortAscending(
  entries: readonly InstitutionalTimelineEntry[],
): readonly InstitutionalTimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.sourceId.localeCompare(b.sourceId)
    return a.occurredAt < b.occurredAt ? -1 : 1
  })
}

// ── Per-source projections ────────────────────────────────────────────────

function decisionsToEntries(
  decisions: readonly DecisionNode[],
): InstitutionalTimelineEntry[] {
  return orderDecisionsChronologically(decisions).map<InstitutionalTimelineEntry>((d) => ({
    occurredAt: d.executedAt ?? d.createdAt ?? new Date(0).toISOString(),
    kind: 'decision',
    entityRef: d.entityId,
    sourceId: d.id,
    summary: d.summary ?? `decision:${d.id}`,
    category: decisionCategory(d) ?? d.decisionType,
    evidenceRefs: d.evidenceRefs && d.evidenceRefs.length > 0 ? d.evidenceRefs : undefined,
    status: d.status,
  }))
}

function edgesToEntries(
  edges: readonly EntityEdge[],
): InstitutionalTimelineEntry[] {
  const out: InstitutionalTimelineEntry[] = []
  for (const e of edges) {
    const kind = edgeIggKind(e)
    const ts = metaTimestamp(e.metadata)
    if (!ts) continue
    let entryKind: InstitutionalTimelineEntryKind | undefined
    let category: string | undefined
    if (kind === IggRelationshipKinds.AFFILIATED_WITH) {
      entryKind = 'affiliation'
      category = 'affiliation_transition'
    } else if (kind === IggRelationshipKinds.REPRESENTS) {
      entryKind = 'representation'
      category = 'representation_transition'
    } else if (
      kind === IggRelationshipKinds.PARENT_OF ||
      kind === IggRelationshipKinds.GOVERNED_BY ||
      kind === IggRelationshipKinds.MEMBER_OF ||
      kind === IggRelationshipKinds.BARGAINS_FOR ||
      kind === IggRelationshipKinds.NEGOTIATES ||
      kind === IggRelationshipKinds.TENURED_AS ||
      kind === IggRelationshipKinds.APPROVES ||
      kind === IggRelationshipKinds.SUPERSEDES ||
      kind === IggRelationshipKinds.DEPENDS_ON ||
      kind === IggRelationshipKinds.ESCALATED_TO ||
      kind === IggRelationshipKinds.TRIGGERED_BY ||
      kind === IggRelationshipKinds.INFORMED_BY ||
      kind === IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN ||
      kind === IggRelationshipKinds.DELEGATES_TO ||
      kind === IggRelationshipKinds.CASTS
    ) {
      entryKind = 'governance_event'
      category = kind
    } else {
      continue
    }
    out.push({
      occurredAt: ts,
      kind: entryKind,
      entityRef: e.sourceEntityId,
      sourceId: e.id,
      summary:
        metaString(e.metadata, 'summary') ?? `${kind} ${e.sourceEntityId} → ${e.targetEntityId}`,
      category,
      status: metaString(e.metadata, 'status'),
    })
  }
  return out
}

// ── Public builders ───────────────────────────────────────────────────────

/**
 * Build a unified institutional timeline across the supplied graph.
 * Always returns a redacted, chronologically sorted, read-safe view.
 */
export function buildInstitutionalTimeline(
  graph: InstitutionalTimelineGraph,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const safe = redactProtected(graph)
  const entries: InstitutionalTimelineEntry[] = [
    ...decisionsToEntries(safe.decisions ?? []),
    ...edgesToEntries(safe.edges ?? []),
  ]
  // Belt-and-suspenders: if any protected-event-kind decision slipped past
  // category-based redaction (e.g. category was missing but event kind set),
  // strip it explicitly here.
  const filtered = entries.filter((e) => !isProtectedEventKind(e.category))
  const sorted = sortAscending(filtered)
  const final = applyOptions(sorted, options)
  // Re-assert on the underlying surface used to derive entries.
  assertNoProtectedKindsInReadSurface({
    nodes: safe.nodes,
    edges: safe.edges,
    decisions: safe.decisions,
  })
  // Phase 4: projection-level fence — final defensive sweep on the
  // returned entries themselves.
  assertNoProtectedKindsInProjections(final, 'timeline')
  return final
}

/** Timeline anchored to a single organization (and its directly-touching events). */
export function timelineForOrganization(
  graph: InstitutionalTimelineGraph,
  organizationId: string,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const all = buildInstitutionalTimeline(graph, options)
  return all.filter((e) => e.entityRef === organizationId)
}

/**
 * Timeline of a single decision plus its lineage chain (older / newer
 * decisions linked via SUPERSEDES / OVERRIDES on the underlying entity).
 */
export function timelineForDecision(
  graph: InstitutionalTimelineGraph,
  decisionId: string,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const safe = redactProtected(graph)
  const target = (safe.decisions ?? []).find((d) => d.id === decisionId)
  if (!target) return []
  const lineageEntities = new Set<string>(
    lineageChain(target.entityId, safe.edges ?? []),
  )
  lineageEntities.add(target.entityId)
  const decisionEntries = decisionsToEntries(safe.decisions ?? []).filter((e) =>
    lineageEntities.has(e.entityRef),
  )
  const lineageMarkers: InstitutionalTimelineEntry[] = []
  for (const e of safe.edges ?? []) {
    const kind = edgeIggKind(e)
    if (
      kind === IggRelationshipKinds.SUPERSEDES &&
      (lineageEntities.has(e.sourceEntityId) || lineageEntities.has(e.targetEntityId))
    ) {
      const ts = metaTimestamp(e.metadata)
      if (!ts) continue
      lineageMarkers.push({
        occurredAt: ts,
        kind: 'lineage',
        entityRef: e.sourceEntityId,
        sourceId: e.id,
        summary: `supersedes ${e.targetEntityId}`,
        category: 'lineage_succession',
      })
    }
  }
  return applyOptions(sortAscending([...decisionEntries, ...lineageMarkers]), options)
}

/** Timeline scoped to a single affiliation edge id (its formation event). */
export function timelineForAffiliation(
  graph: InstitutionalTimelineGraph,
  affiliationEdgeId: string,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const all = buildInstitutionalTimeline(graph, options)
  return all.filter(
    (e) => e.kind === 'affiliation' && e.sourceId === affiliationEdgeId,
  )
}

/** Timeline scoped to a single representation edge id. */
export function timelineForRepresentation(
  graph: InstitutionalTimelineGraph,
  representationEdgeId: string,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const all = buildInstitutionalTimeline(graph, options)
  return all.filter(
    (e) => e.kind === 'representation' && e.sourceId === representationEdgeId,
  )
}

/**
 * Continuity timeline — entries whose anchor entity belongs to the
 * AFFILIATED_WITH cohort of the given organization (federation/congress).
 */
export function continuityTimeline(
  graph: InstitutionalTimelineGraph,
  organizationId: string,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const safe = redactProtected(graph)
  const cohort = new Set<string>(continuityCohort(organizationId, safe.edges ?? []))
  cohort.add(organizationId)
  const all = buildInstitutionalTimeline(safe, options)
  return all.filter((e) => cohort.has(e.entityRef))
}

/**
 * Governance epoch markers — institutional foundings (entity creation
 * timestamps recorded on metadata) and protocol amendments. Returns a
 * coarse, read-safe outline of "when did the institution change shape?".
 *
 * Excludes any protected entity kinds (Class B, reserved-matter, etc.) and
 * any protected event kinds. Never exposes continuity-protection structures.
 */
export function governanceEpochTimeline(
  graph: InstitutionalTimelineGraph,
  options?: InstitutionalTimelineOptions,
): readonly InstitutionalTimelineEntry[] {
  const safe = redactProtected(graph)
  const entries: InstitutionalTimelineEntry[] = []
  // Entity foundings derived from metadata timestamp (when present).
  for (const n of safe.nodes ?? []) {
    if (isProtectedEntityKind(entityIggKind(n))) continue
    const ts = metaTimestamp(n.metadata) ?? metaString(n.metadata, 'foundedAt')
    if (!ts) continue
    entries.push({
      occurredAt: ts,
      kind: 'epoch_marker',
      entityRef: n.entityId,
      sourceId: n.entityId,
      summary: metaString(n.metadata, 'summary') ?? `founded:${n.canonicalName}`,
      category: entityIggKind(n) ?? 'entity_founded',
      status: n.status,
    })
  }
  // Protocol amendments and CBA ratifications recorded as decisions.
  for (const d of safe.decisions ?? []) {
    if (isProtectedEventKind(decisionEventKind(d))) continue
    const cat = decisionCategory(d)
    const ev = decisionEventKind(d)
    const isEpoch =
      cat === 'protocol_amendment' ||
      cat === 'cba_ratification' ||
      ev === 'igg:protocol_amendment' ||
      ev === 'igg:cba_ratified'
    if (!isEpoch) continue
    entries.push({
      occurredAt: d.executedAt ?? d.createdAt ?? new Date(0).toISOString(),
      kind: 'epoch_marker',
      entityRef: d.entityId,
      sourceId: d.id,
      summary: d.summary ?? `epoch:${d.id}`,
      category: cat ?? 'epoch_event',
      status: d.status,
    })
  }
  // Structural reorganizations from SUPERSEDES edges that carry timestamps.
  for (const e of safe.edges ?? []) {
    if (isProtectedRelationshipKind(edgeIggKind(e))) continue
    if (edgeIggKind(e) !== IggRelationshipKinds.SUPERSEDES) continue
    const ts = metaTimestamp(e.metadata)
    if (!ts) continue
    entries.push({
      occurredAt: ts,
      kind: 'epoch_marker',
      entityRef: e.sourceEntityId,
      sourceId: e.id,
      summary: `supersedes ${e.targetEntityId}`,
      category: 'structural_reorganization',
    })
  }
  return applyOptions(sortAscending(entries), options)
}
