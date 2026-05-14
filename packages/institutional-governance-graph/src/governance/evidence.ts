/**
 * Governance — Evidence Convergence (Phase 4 Deliverable #3)
 *
 * Read-only convergence layer that joins governance decisions with their
 * supporting **evidence**, **knowledge**, and **policy** citations. Answers
 * the institutional-history question:
 *
 *   "What documentary record substantiates this governance decision, and
 *    how did the evidentiary trail evolve over time?"
 *
 * NOT a behavioural / influence / predictive surface. This module:
 *   - performs NO ranking, scoring, or weighting of evidence
 *   - performs NO citation-network analysis or graph-influence inference
 *   - performs NO actor profiling or caucus reconstruction
 *   - exposes NO protected-mechanics decisions or events
 *
 * Pipeline (mirrors `./timeline.ts`):
 *   redactProtected → join refs → filter protected event-kind leakage →
 *   sort chronologically → applyOptions → assertNoProtectedKindsInReadSurface
 *
 * Entries are derived strictly from already-redacted DecisionNodes; no edge
 * or entity-level data is exposed beyond the entityRef anchor.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'

import { orderDecisionsChronologically } from './chronology'
import {
  assertNoProtectedKindsInProjections,
  assertNoProtectedKindsInReadSurface,
  isProtectedEventKind,
  redactProtected,
} from './protected'
import { continuityCohort } from './queries'

// ── Public types ──────────────────────────────────────────────────────────

/**
 * A single converged evidence entry: a decision plus its citation triplet.
 * Always represents a redacted, read-safe slice — protected decisions never
 * appear here.
 */
export interface EvidenceConvergenceEntry {
  readonly occurredAt: string
  readonly decisionId: string
  readonly entityRef: string
  readonly decisionType: string
  readonly summary: string
  readonly evidenceRefs: readonly string[]
  readonly knowledgeRefs: readonly string[]
  readonly policyRefs: readonly string[]
  readonly category?: string
  readonly status?: string
}

/** Substrate slice consumed by evidence convergence. */
export interface EvidenceConvergenceGraph {
  readonly nodes?: readonly EntityNode[]
  readonly edges?: readonly EntityEdge[]
  readonly decisions?: readonly DecisionNode[]
}

/** Read-only filter options for evidence convergence queries. */
export interface EvidenceConvergenceOptions {
  readonly since?: string
  readonly until?: string
  /** Restrict to entries with at least one evidenceRefs item. */
  readonly requireEvidence?: boolean
  /** Restrict to entries with at least one knowledgeRefs item. */
  readonly requireKnowledge?: boolean
  /** Restrict to entries with at least one policyRefs item. */
  readonly requirePolicy?: boolean
  /** Restrict to specific DecisionNode.decisionType values. */
  readonly decisionTypes?: readonly string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────

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

function decisionsToEntries(
  decisions: readonly DecisionNode[],
): EvidenceConvergenceEntry[] {
  return orderDecisionsChronologically(decisions).map<EvidenceConvergenceEntry>((d) => ({
    occurredAt: d.executedAt ?? d.createdAt ?? new Date(0).toISOString(),
    decisionId: d.id,
    entityRef: d.entityId,
    decisionType: d.decisionType,
    summary: d.summary ?? `decision:${d.id}`,
    evidenceRefs: d.evidenceRefs ?? [],
    knowledgeRefs: d.knowledgeRefs ?? [],
    policyRefs: d.policyRefs ?? [],
    category: decisionCategory(d),
    status: d.status,
  }))
}

function sortAscending(
  entries: readonly EvidenceConvergenceEntry[],
): readonly EvidenceConvergenceEntry[] {
  return [...entries].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.decisionId.localeCompare(b.decisionId)
    return a.occurredAt < b.occurredAt ? -1 : 1
  })
}

function applyOptions(
  entries: readonly EvidenceConvergenceEntry[],
  options: EvidenceConvergenceOptions | undefined,
): readonly EvidenceConvergenceEntry[] {
  if (!options) return entries
  const { since, until, requireEvidence, requireKnowledge, requirePolicy, decisionTypes } =
    options
  return entries.filter((e) => {
    if (since && e.occurredAt < since) return false
    if (until && e.occurredAt > until) return false
    if (requireEvidence && e.evidenceRefs.length === 0) return false
    if (requireKnowledge && e.knowledgeRefs.length === 0) return false
    if (requirePolicy && e.policyRefs.length === 0) return false
    if (decisionTypes && decisionTypes.length > 0 && !decisionTypes.includes(e.decisionType))
      return false
    return true
  })
}

// ── Public builders ───────────────────────────────────────────────────────

/**
 * Build the unified evidence-convergence chronology over the supplied graph.
 * Always returns a redacted, chronologically sorted, read-safe view.
 */
export function buildEvidenceConvergence(
  graph: EvidenceConvergenceGraph,
  options?: EvidenceConvergenceOptions,
): readonly EvidenceConvergenceEntry[] {
  const safe = redactProtected(graph)
  const decisions = safe.decisions ?? []
  // Belt-and-suspenders: drop any decision whose explicit iggEventKind is
  // protected even if its category was missing during redaction.
  const cleaned = decisions.filter((d) => !isProtectedEventKind(decisionEventKind(d)))
  const entries = decisionsToEntries(cleaned)
  const sorted = sortAscending(entries)
  const final = applyOptions(sorted, options)
  assertNoProtectedKindsInReadSurface({
    nodes: safe.nodes,
    edges: safe.edges,
    decisions: cleaned,
  })
  // Phase 4: projection-level fence — final defensive sweep on the
  // returned entries themselves.
  assertNoProtectedKindsInProjections(final, 'evidence')
  return final
}

/**
 * Evidence convergence for a single decision id. Returns at most one entry,
 * or an empty array if the decision is unknown or was redacted.
 */
export function evidenceForDecision(
  graph: EvidenceConvergenceGraph,
  decisionId: string,
): readonly EvidenceConvergenceEntry[] {
  return buildEvidenceConvergence(graph).filter((e) => e.decisionId === decisionId)
}

/** Evidence convergence anchored to a single entity (organization, role, etc.). */
export function evidenceForEntity(
  graph: EvidenceConvergenceGraph,
  entityRef: string,
  options?: EvidenceConvergenceOptions,
): readonly EvidenceConvergenceEntry[] {
  return buildEvidenceConvergence(graph, options).filter((e) => e.entityRef === entityRef)
}

/**
 * Evidence convergence aggregated across an organization and the entities
 * affiliated with it (per `continuityCohort`). Read-only; no inference, no
 * actor reconstruction.
 */
export function evidenceForOrganization(
  graph: EvidenceConvergenceGraph,
  organizationId: string,
  options?: EvidenceConvergenceOptions,
): readonly EvidenceConvergenceEntry[] {
  const cohort = new Set<string>([
    organizationId,
    ...continuityCohort(organizationId, graph.edges ?? []),
  ])
  return buildEvidenceConvergence(graph, options).filter((e) => cohort.has(e.entityRef))
}

/**
 * Aggregate union of citation IDs across the redacted, read-safe convergence.
 * Useful for "what documents underlie this organization's governance record?"
 * style read-only summaries. Order is sorted-ascending and de-duplicated.
 */
export interface EvidenceCitationSummary {
  readonly evidenceRefs: readonly string[]
  readonly knowledgeRefs: readonly string[]
  readonly policyRefs: readonly string[]
}

export function summarizeCitations(
  entries: readonly EvidenceConvergenceEntry[],
): EvidenceCitationSummary {
  const evidence = new Set<string>()
  const knowledge = new Set<string>()
  const policy = new Set<string>()
  for (const e of entries) {
    for (const r of e.evidenceRefs) evidence.add(r)
    for (const r of e.knowledgeRefs) knowledge.add(r)
    for (const r of e.policyRefs) policy.add(r)
  }
  return {
    evidenceRefs: [...evidence].sort(),
    knowledgeRefs: [...knowledge].sort(),
    policyRefs: [...policy].sort(),
  }
}
