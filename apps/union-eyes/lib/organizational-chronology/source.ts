/**
 * Organizational Chronology — read-only data adapter.
 *
 * Composes chronological views (procedural timeline, organizational
 * evolution, decision lineage, continuity progression, governance
 * epochs, chronology explainability) over the organizational substrate
 * using only the public IGG governance builders. Every collection passes
 * through `redactProtected` and the IGG protected-kind fences before it
 * reaches this surface.
 *
 * Doctrine: this module answers "When did this organizational state
 * emerge, and through which preserved procedural events?" — never
 * "What activity is happening now, what should we optimize, or which
 * outcomes do we predict?". No automation, no scoring, no behavioural
 * analytics. Protected organizational semantics are filtered at the
 * graph layer.
 */

import {
  assertNoProtectedKindsInProjections,
  buildContinuityTimeline,
  buildExplainabilityRecords,
  buildInstitutionalTimeline,
  chronologyForEntity,
  continuityForOrganization,
  governanceEpochTimeline,
  lineageChain,
  redactProtected,
  successionBreakpoints,
  summarizeProvenanceCoverage,
  timelineForAffiliation,
  timelineForDecision,
  timelineForOrganization,
  timelineForRepresentation,
  type ChronologyEntry,
  type ContinuityEntry,
  type ExplainabilityRecord,
  type InstitutionalTimelineEntry,
  type InstitutionalTimelineGraph,
  type ProvenanceCoverageSummary,
  type SuccessionBreakpoint,
} from '@nzila/organizational-governance-graph'

import { getInstitutionalGraph } from '../organizational-topology/source'

// ── View shapes ─────────────────────────────────────────────────────────────

export interface ProceduralTimelineView {
  readonly entries: readonly InstitutionalTimelineEntry[]
}

export interface OrganizationEvolutionView {
  readonly organizationId: string
  readonly entries: readonly InstitutionalTimelineEntry[]
}

export interface AffiliationEvolutionView {
  readonly affiliationEdgeId: string
  readonly entries: readonly InstitutionalTimelineEntry[]
}

export interface RepresentationEvolutionView {
  readonly representationEdgeId: string
  readonly entries: readonly InstitutionalTimelineEntry[]
}

export interface OrganizationalEvolutionView {
  readonly organizations: readonly OrganizationEvolutionView[]
  readonly affiliations: readonly AffiliationEvolutionView[]
  readonly representations: readonly RepresentationEvolutionView[]
}

export interface DecisionLineageView {
  readonly originEntityId: string
  readonly chain: readonly string[]
  readonly chronology: readonly ChronologyEntry[]
  readonly decisionTimelines: readonly {
    readonly decisionId: string
    readonly entries: readonly InstitutionalTimelineEntry[]
  }[]
}

export interface ContinuityProgressionView {
  readonly organizationId: string
  readonly entries: readonly ContinuityEntry[]
  readonly breakpoints: readonly SuccessionBreakpoint[]
}

export interface InstitutionalChronologyView {
  readonly generatedAt: string
  readonly substrate: {
    readonly nodes: number
    readonly edges: number
    readonly decisions: number
  }
  readonly proceduralTimeline: ProceduralTimelineView
  readonly evolution: OrganizationalEvolutionView
  readonly lineage: readonly DecisionLineageView[]
  readonly continuity: readonly ContinuityProgressionView[]
  readonly epochs: readonly InstitutionalTimelineEntry[]
  readonly explainability: readonly ExplainabilityRecord[]
  readonly provenanceCoverage: ProvenanceCoverageSummary
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readEdgeKind(edge: { metadata?: unknown }): string | undefined {
  return (edge.metadata as Record<string, unknown> | undefined)?.iggKind as
    | string
    | undefined
}

// ── Composition ─────────────────────────────────────────────────────────────

/**
 * Composes the read-only chronology view from the IGG public builders.
 * Every list returned here originates from a single `redactProtected`
 * pass at the adapter layer, and is re-asserted via the projection
 * fence before being handed to the UI surface.
 */
export async function getInstitutionalChronologyView(): Promise<InstitutionalChronologyView> {
  const raw = await getInstitutionalGraph()
  const safe: InstitutionalTimelineGraph = redactProtected(raw)
  const nodes = safe.nodes ?? []
  const edges = safe.edges ?? []
  const decisions = safe.decisions ?? []

  // Procedural timeline — unified organizational timeline across the
  // redacted graph (chronologically ascending).
  const proceduralEntries = buildInstitutionalTimeline(safe)

  // Organizational evolution — per-organization timelines plus the
  // formation timelines for each affiliation / representation edge.
  const organizationIds = new Set<string>()
  const affiliationEdgeIds: string[] = []
  const representationEdgeIds: string[] = []
  for (const edge of edges) {
    const kind = readEdgeKind(edge)
    if (kind === 'AFFILIATED_WITH') {
      affiliationEdgeIds.push(edge.id)
      organizationIds.add(edge.targetEntityId)
    } else if (kind === 'REPRESENTS') {
      representationEdgeIds.push(edge.id)
    }
  }
  // Also surface organizations that appear as decision subjects so the
  // evolution panel does not collapse to zero on graphs without
  // affiliation edges yet.
  for (const d of decisions) organizationIds.add(d.entityId)

  const organizations: readonly OrganizationEvolutionView[] = Array.from(
    organizationIds,
  )
    .sort()
    .map((organizationId) => ({
      organizationId,
      entries: timelineForOrganization(safe, organizationId),
    }))

  const affiliations: readonly AffiliationEvolutionView[] = affiliationEdgeIds
    .slice()
    .sort()
    .map((affiliationEdgeId) => ({
      affiliationEdgeId,
      entries: timelineForAffiliation(safe, affiliationEdgeId),
    }))

  const representations: readonly RepresentationEvolutionView[] =
    representationEdgeIds
      .slice()
      .sort()
      .map((representationEdgeId) => ({
        representationEdgeId,
        entries: timelineForRepresentation(safe, representationEdgeId),
      }))

  const evolution: OrganizationalEvolutionView = {
    organizations,
    affiliations,
    representations,
  }

  // Decision lineage — walk SUPERSEDES/OVERRIDES from each entity (via
  // `lineageChain`); deduplicate by lineage origin so each chain appears
  // once. Pair each chain with the entity chronology and per-decision
  // timelines for the decisions on the origin entity.
  const seenChains = new Set<string>()
  const lineage: DecisionLineageView[] = []
  for (const node of nodes) {
    const chain = lineageChain(node.entityId, edges)
    if (chain.length === 0) continue
    const origin = chain[0]!
    if (seenChains.has(origin)) continue
    seenChains.add(origin)
    const chronology = chronologyForEntity(origin, decisions)
    const decisionTimelines = chronology.map((c) => ({
      decisionId: c.decisionId,
      entries: timelineForDecision(safe, c.decisionId),
    }))
    lineage.push({
      originEntityId: origin,
      chain,
      chronology,
      decisionTimelines,
    })
  }

  // Continuity progression — per-organization succession / tenure /
  // affiliation transitions plus the read-safe succession breakpoints.
  const breakpoints = successionBreakpoints(safe)
  const continuity: readonly ContinuityProgressionView[] = Array.from(
    organizationIds,
  )
    .sort()
    .map((organizationId) => ({
      organizationId,
      entries: continuityForOrganization(safe, organizationId),
      breakpoints: breakpoints.filter(
        (b) =>
          b.predecessorEntityId === organizationId ||
          b.successorEntityId === organizationId,
      ),
    }))
  // Fall back to a single, unscoped continuity bucket when there are no
  // organizations yet so the panel can still render an empty state.
  const continuityWithFallback: readonly ContinuityProgressionView[] =
    continuity.length > 0
      ? continuity
      : [
          {
            organizationId: '',
            entries: buildContinuityTimeline(safe),
            breakpoints,
          },
        ]

  // Governance epochs — coarse "when did the institution change shape"
  // markers (foundings, protocol amendments, ratifications).
  const epochs = governanceEpochTimeline(safe)

  // Chronology explainability — per-decision provenance convergence
  // plus a counts-only coverage summary (no scoring, no ratios).
  const explainability = buildExplainabilityRecords(safe)
  const provenanceCoverage = summarizeProvenanceCoverage(explainability)

  // Final defensive sweep: re-assert the projection fence on the
  // collections we are about to hand to the UI. The underlying builders
  // already perform this internally; this is the adapter-layer
  // belt-and-suspenders pass.
  assertNoProtectedKindsInProjections(proceduralEntries, 'chronology.procedural')
  assertNoProtectedKindsInProjections(epochs, 'chronology.epochs')
  for (const org of organizations) {
    assertNoProtectedKindsInProjections(org.entries, 'chronology.evolution.organization')
  }
  for (const aff of affiliations) {
    assertNoProtectedKindsInProjections(aff.entries, 'chronology.evolution.affiliation')
  }
  for (const rep of representations) {
    assertNoProtectedKindsInProjections(rep.entries, 'chronology.evolution.representation')
  }
  for (const cont of continuityWithFallback) {
    assertNoProtectedKindsInProjections(cont.entries, 'chronology.continuity')
  }
  for (const lin of lineage) {
    for (const t of lin.decisionTimelines) {
      assertNoProtectedKindsInProjections(t.entries, 'chronology.lineage.decision')
    }
  }
  assertNoProtectedKindsInProjections(
    explainability.map((r) => ({ category: r.category, summary: r.summary })),
    'chronology.explainability',
  )

  return {
    generatedAt: new Date().toISOString(),
    substrate: {
      nodes: nodes.length,
      edges: edges.length,
      decisions: decisions.length,
    },
    proceduralTimeline: { entries: proceduralEntries },
    evolution,
    lineage,
    continuity: continuityWithFallback,
    epochs,
    explainability,
    provenanceCoverage,
  }
}
