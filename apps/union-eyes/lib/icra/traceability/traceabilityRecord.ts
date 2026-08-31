/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Traceability Record
 * MODULE: OCI/OCRA TraceabilityRecord (persistable, audit-safe, PII-free)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Aggregates derived findings and computes chain integrity. Mirrors the
 * RoutingExplainabilitySnapshot pattern: pure, JSON-persistable, no PII, no I/O.
 *
 * INTEGRITY INVARIANTS (enforced by no-orphan-recommendations.test.ts):
 *   - Every finding is evidence-linked, confidence-bounded, obligation-mapped.
 *   - Every finding carries ≥ 1 recommendation reference (no dead-end findings).
 *   - When a surfaced-recommendation set is supplied, every surfaced
 *     recommendation resolves to ≥ 1 finding (no orphan recommendations).
 *   - `intact` must be true before a report may render findings.
 */

import type { ScoringTrace } from '../scoring';
import { OBLIGATION_TAXONOMY_VERSION } from '../obligations/obligationTaxonomy';
import { CONSEQUENCE_MODEL_VERSION } from '../consequences/consequenceModel';
import {
  ASSERTION_FLOOR_BY_KIND,
  SOURCE_INSTRUMENT_CATALOGUE_VERSION,
  type Citation,
} from '../obligations/sourceInstruments';
import { mapObligationsToCitations } from '../obligations/sourceInstrumentMapping';
import { isAtLeast } from '../evidence-strength/evidenceTaxonomy';
import type { Finding } from '../findings/finding';

export interface ChainIntegrity {
  readonly everyFindingHasEvidence: boolean;
  readonly everyFindingHasConfidence: boolean;
  readonly everyFindingHasObligation: boolean;
  /**
   * Every finding references ≥ 1 recommendation id in its `recommendationRefs`.
   * This proves findings are recommendation-linked; it does NOT by itself prove
   * that every recommendation actually surfaced in a report is backed by a
   * finding. Use `everySurfacedRecommendationHasFinding` for that guarantee.
   */
  readonly everyFindingHasRecommendationRef: boolean;
  /**
   * DEPRECATED alias for `everyFindingHasRecommendationRef`. Retained for
   * backward compatibility with existing tests and documentation; the name is
   * historically misleading (it proves finding-side completeness, not that no
   * recommendation is orphaned). Prefer `everySurfacedRecommendationHasFinding`.
   * @deprecated
   */
  readonly everyRecommendationHasFinding: boolean;
  /**
   * When the caller supplies the set of recommendation ids actually surfaced
   * in the report, this asserts each one resolves to ≥ 1 finding. When no
   * surfaced set is supplied, this is `null` (undetermined) and must not be
   * treated as `true` for gating.
   */
  readonly everySurfacedRecommendationHasFinding: boolean | null;
  /**
   * Phase G: no citation is `asserted` below its instrument's evidence floor
   * (e.g. a statute is never asserted on less than VERIFIED evidence).
   */
  readonly everyAssertedCitationMeetsEvidenceFloor: boolean;
  /** AND of the enforceable checks above — gate for rendering findings. */
  readonly intact: boolean;
}

/** Phase G: the source-instrument citations derived for a single finding. */
export interface FindingCitations {
  readonly findingId: string;
  readonly citations: readonly Citation[];
}

export interface TraceabilityRecord {
  readonly assessmentId: string;
  readonly scoringVersion: string;
  readonly questionBankVersion: number;
  readonly obligationTaxonomyVersion: string;
  readonly consequenceModelVersion: string;
  readonly sourceInstrumentCatalogueVersion: string;
  readonly findings: readonly Finding[];
  /** Phase G: per-finding source-instrument citations (read-only projection). */
  readonly findingCitations: readonly FindingCitations[];
  readonly chainIntegrity: ChainIntegrity;
}

/**
 * Resolve the set of recommendation ids known to be backed by ≥ 1 finding.
 * Used to assert no recommendation is surfaced without a finding behind it.
 */
export function recommendationsWithFinding(
  findings: readonly Finding[],
): ReadonlySet<string> {
  const set = new Set<string>();
  for (const finding of findings) {
    for (const ref of finding.recommendationRefs) set.add(ref);
  }
  return set;
}

/** Phase G: derive the per-finding source-instrument citations (read-only). */
export function deriveFindingCitations(
  findings: readonly Finding[],
): readonly FindingCitations[] {
  return Object.freeze(
    findings.map((finding) => ({
      findingId: finding.findingId,
      citations: mapObligationsToCitations(
        finding.obligationClasses,
        finding.evidenceLevel,
      ),
    })),
  );
}

function computeChainIntegrity(
  findings: readonly Finding[],
  findingCitations: readonly FindingCitations[],
  surfacedRecommendationIds: ReadonlySet<string> | null,
): ChainIntegrity {
  const everyFindingHasEvidence = findings.every((f) => f.evidenceLevel != null);
  const everyFindingHasConfidence = findings.every((f) => f.confidence != null);
  const everyFindingHasObligation = findings.every((f) => f.obligationClasses.length >= 1);
  const everyFindingHasRecommendationRef = findings.every(
    (f) => f.recommendationRefs.length >= 1,
  );

  // True no-orphan-recommendation invariant: only computable when the caller
  // supplies the actual set of surfaced recommendation ids. When absent, we
  // cannot claim this property is proven.
  const backed = recommendationsWithFinding(findings);
  const everySurfacedRecommendationHasFinding: boolean | null =
    surfacedRecommendationIds == null
      ? null
      : Array.from(surfacedRecommendationIds).every((id) => backed.has(id));

  // Phase G invariant: any citation presented as `asserted` must clear its
  // instrument kind's evidence floor. Vacuously true when there are no asserted
  // citations (e.g. statutes referenced below VERIFIED stay `referenced`).
  const evidenceByFinding = new Map(findings.map((f) => [f.findingId, f.evidenceLevel]));
  const everyAssertedCitationMeetsEvidenceFloor = findingCitations.every((fc) => {
    const evidence = evidenceByFinding.get(fc.findingId);
    if (evidence == null) return true;
    return fc.citations.every((c) =>
      c.assertion === 'asserted'
        ? isAtLeast(evidence, ASSERTION_FLOOR_BY_KIND[c.kind])
        : true,
    );
  });

  return Object.freeze({
    everyFindingHasEvidence,
    everyFindingHasConfidence,
    everyFindingHasObligation,
    everyFindingHasRecommendationRef,
    // Backward-compat alias — same semantics, historically misleading name.
    everyRecommendationHasFinding: everyFindingHasRecommendationRef,
    everySurfacedRecommendationHasFinding,
    everyAssertedCitationMeetsEvidenceFloor,
    intact:
      everyFindingHasEvidence &&
      everyFindingHasConfidence &&
      everyFindingHasObligation &&
      everyFindingHasRecommendationRef &&
      everyAssertedCitationMeetsEvidenceFloor &&
      // If the caller supplied a surfaced set, it must also pass. If null,
      // we do not use it to weaken `intact` — but the field is null so callers
      // can see the property was not proven.
      (everySurfacedRecommendationHasFinding !== false),
  });
}

/**
 * Build a version-pinned, append-only traceability record from a scoring trace
 * and its derived findings. Pure and deterministic; contains no PII.
 *
 * @param surfacedRecommendationIds Optional set of recommendation ids actually
 * surfaced in the report. When supplied, enables the true
 * `everySurfacedRecommendationHasFinding` invariant. When omitted, that
 * invariant is reported as `null` (undetermined).
 */
export function buildTraceabilityRecord(
  assessmentId: string,
  trace: ScoringTrace,
  findings: readonly Finding[],
  surfacedRecommendationIds?: ReadonlySet<string>,
): TraceabilityRecord {
  const findingCitations = deriveFindingCitations(findings);
  return Object.freeze({
    assessmentId,
    scoringVersion: trace.scoringVersion,
    questionBankVersion: trace.questionBankVersion,
    obligationTaxonomyVersion: OBLIGATION_TAXONOMY_VERSION,
    consequenceModelVersion: CONSEQUENCE_MODEL_VERSION,
    sourceInstrumentCatalogueVersion: SOURCE_INSTRUMENT_CATALOGUE_VERSION,
    findings,
    findingCitations,
    chainIntegrity: computeChainIntegrity(
      findings,
      findingCitations,
      surfacedRecommendationIds ?? null,
    ),
  });
}
