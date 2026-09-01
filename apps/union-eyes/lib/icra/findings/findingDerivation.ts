/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Finding Derivation
 * MODULE: OCI/OCRA deterministic finding derivation
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Derives Findings from a ScoringTrace + reviewer-supplied evidence. Pure and
 * deterministic: identical (trace, evidence) inputs yield identical findings.
 *
 * READ-ONLY OVER THE FROZEN CORE: this module reads ScoringTrace; it never
 * mutates the trace and never recomputes any score, dimension, or band.
 *
 * A finding is only surfaced when the seven-answer contract is complete
 * (see finding.ts `isComplete`). Themes with no reviewer evidence, or evidence
 * too weak to admit any obligation class, are suppressed — never surfaced partial.
 */

import type { DimensionId, SectionId } from '../types';
import type { ScoringTrace, QuestionTrace } from '../scoring';
import type { EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';
import { mapFindingToObligations } from '../obligations/obligationMapping';
import { mapFindingToConsequence } from '../consequences/consequenceModel';
import { buildFindingConfidence } from '../confidence/findingConfidence';
import { isComplete, type AffectedDimension, type Finding, type FindingSeverity } from './finding';

interface FindingRule {
  readonly section: SectionId;
  readonly theme: string;
  readonly statement: string;
  /** Surfaces when the section signal (0..100) is at or below this threshold. */
  readonly triggerBelow: number;
  /** Existing recommendation ids (from recommendations.ts catalogue). */
  readonly recommendationRefs: readonly string[];
}

/**
 * Deterministic section → theme rules. Each maps a continuity-weak section to a
 * canonical finding theme with a calm recommendation reference.
 */
export const FINDING_RULES: readonly FindingRule[] = Object.freeze([
  {
    section: 'transition_readiness',
    theme: 'undocumented_succession_authority',
    statement: 'Succession authority is not documented as a governance instrument.',
    triggerBelow: 70,
    recommendationRefs: ['rec.governance_workshop', 'rec.continuity_review'],
  },
  {
    section: 'operational_dependency',
    theme: 'single_point_operational_dependency',
    statement: 'Core operations depend on a single point without a documented fallback.',
    triggerBelow: 70,
    recommendationRefs: ['rec.continuity_review'],
  },
  {
    section: 'governance_visibility',
    theme: 'board_oversight_gap',
    statement: 'Governance oversight cannot be consistently evidenced from records.',
    triggerBelow: 70,
    recommendationRefs: ['rec.governance_workshop'],
  },
  {
    section: 'institutional_memory',
    theme: 'institutional_memory_concentration',
    statement: 'Institutional memory is concentrated and not durably recorded.',
    triggerBelow: 70,
    recommendationRefs: ['rec.starter_kit', 'rec.continuity_review'],
  },
  {
    section: 'operational_coordination',
    theme: 'no_continuity_plan',
    statement: 'No documented continuity plan coordinates operations across disruption.',
    triggerBelow: 70,
    recommendationRefs: ['rec.continuity_review'],
  },
  {
    section: 'explainability_trust',
    theme: 'records_retention_gap',
    statement: 'Decision and record retention is insufficient to reconstruct accountability.',
    triggerBelow: 70,
    recommendationRefs: ['rec.continuity_review'],
  },
  {
    section: 'sovereignty_governance',
    theme: 'missing_delegation_instrument',
    statement: 'Delegation of authority is not captured in a governing instrument.',
    triggerBelow: 70,
    recommendationRefs: ['rec.governance_workshop'],
  },
]);

function severityFor(sectionSignal: number): FindingSeverity {
  if (sectionSignal < 30) return 'critical';
  if (sectionSignal < 50) return 'serious';
  if (sectionSignal < 70) return 'material';
  return 'attention';
}

/** Average effective score (0..1) across a section's answered questions. */
function sectionSignal(traces: readonly QuestionTrace[], section: SectionId): number | null {
  const inSection = traces.filter((t) => t.sectionId === section);
  if (inSection.length === 0) return null;
  const sum = inSection.reduce((acc, t) => acc + t.effectiveScore, 0);
  return sum / inSection.length;
}

/** Aggregate dimension contributions across a section's questions (READ-ONLY). */
function affectedDimensions(
  traces: readonly QuestionTrace[],
  section: SectionId,
): readonly AffectedDimension[] {
  const totals = new Map<DimensionId, number>();
  for (const t of traces) {
    if (t.sectionId !== section) continue;
    for (const [dim, contribution] of Object.entries(t.dimensionContributions) as [
      DimensionId,
      number,
    ][]) {
      totals.set(dim, (totals.get(dim) ?? 0) + contribution);
    }
  }
  return Object.freeze(
    [...totals.entries()]
      .filter(([, contribution]) => contribution !== 0)
      .map(([dimension, contribution]) => ({ dimension, contribution }))
      .sort((a, b) => a.dimension.localeCompare(b.dimension)),
  );
}

export interface EvidenceInputs {
  /** Reviewer-supplied evidence level per finding theme. */
  readonly evidenceByTheme: Readonly<Record<string, EvidenceLevel>>;
  /** Themes the reviewer has independently corroborated (≥2 sources). */
  readonly corroboratedThemes?: readonly string[];
  /** Inter-reviewer variance in [0,1]. */
  readonly reviewerVariance?: number;
  /** Age of the assessment in days, for temporal decay. */
  readonly assessmentAgeDays?: number;
}

/**
 * Derive the complete, ordered set of surfaced findings. Deterministic: the
 * output is sorted by `findingId` and is a pure function of its inputs.
 */
export function deriveFindings(
  trace: ScoringTrace,
  evidence: EvidenceInputs,
): readonly Finding[] {
  const corroborated = new Set(evidence.corroboratedThemes ?? []);
  const findings: Finding[] = [];

  for (const rule of FINDING_RULES) {
    const signal = sectionSignal(trace.questionTraces, rule.section);
    if (signal == null) continue;

    const signalPct = signal * 100;
    if (signalPct > rule.triggerBelow) continue;

    const evidenceLevel = evidence.evidenceByTheme[rule.theme];
    if (evidenceLevel == null) continue; // cannot complete the seven answers → suppress

    const confidence = buildFindingConfidence({
      evidenceLevel,
      corroborated: corroborated.has(rule.theme),
      reviewerVariance: evidence.reviewerVariance,
      assessmentAgeDays: evidence.assessmentAgeDays,
    });

    const obligationClasses = mapFindingToObligations(rule.theme, evidenceLevel);
    const consequence = mapFindingToConsequence(rule.theme, confidence.confidence);
    const dimensions = affectedDimensions(trace.questionTraces, rule.section);
    const contributingQuestionIds = Object.freeze(
      trace.questionTraces
        .filter((t) => t.sectionId === rule.section)
        .map((t) => t.questionId),
    );

    const finding: Finding = {
      findingId: `f.${rule.theme}`,
      theme: rule.theme,
      statement: rule.statement,
      contributingQuestionIds,
      evidenceLevel,
      affectedDimensions: dimensions,
      obligationClasses,
      severity: severityFor(signalPct),
      confidence,
      consequence,
      recommendationRefs: rule.recommendationRefs,
    };

    // Seven-answer completeness gate: never surface a partial finding.
    if (isComplete(finding)) findings.push(finding);
  }

  return Object.freeze(findings.sort((a, b) => a.findingId.localeCompare(b.findingId)));
}
