/**
 * Continuity Archetype Signals — organizational pattern detection.
 *
 * Combines structural signals (multiple_choice) with confidence signals
 * (likert_5) and existing dimension scores to surface recognizable
 * organizational continuity archetypes.
 *
 * Archetypes are descriptive, not normative. They are not rankings.
 *
 * Doctrine source: docs/oci/assessment/OCI_MODALITY_DOCTRINE.md §5,
 * OCI_QUESTION_ARCHITECTURE.md §9.
 */

import type { ContinuityArchetypeId, DimensionScore } from './types';
import type { StructuralContinuitySignal } from './structuralContinuitySignals';
import type { ContinuityConfidenceSignal } from './continuityConfidenceSignals';

export type ArchetypeStrength = 'observed' | 'notable' | 'pronounced';

export interface ContinuityArchetypeReading {
  archetype: ContinuityArchetypeId;
  strength: ArchetypeStrength;
  /** Number of distinct structural patterns supporting this archetype. */
  supportingPatternCount: number;
  /** Mean confidence (0..1) across confidence signals that touch this archetype, if any. */
  associatedConfidence: number | null;
  /** Calm one-line description. */
  description: string;
}

const ARCHETYPE_DESCRIPTIONS: Record<ContinuityArchetypeId, string> = {
  stewardship_concentration:
    'Continuity stewardship is concentrated in a small number of individuals.',
  governance_fragmentation:
    'Governance authority and escalation paths are unevenly distributed.',
  onboarding_survivability:
    'Organizational intelligence transfer at onboarding is incomplete or observational.',
  operational_continuity:
    'Operational continuity is structurally distributed and documented.',
  modernization_fragility:
    'Modernization decisions do not consistently preserve organizational continuity.',
  institutional_memory_dependency:
    'Organizational memory depends on long-tenured individuals rather than infrastructure.',
};

/**
 * Confidence domains that act as evidence for or against specific archetypes.
 * Mapping is descriptive: low confidence in a domain strengthens the
 * archetype associated with that fragility; high confidence weakens it.
 */
const ARCHETYPE_CONFIDENCE_INPUTS: Partial<
  Record<ContinuityArchetypeId, Array<ContinuityConfidenceSignal['domain']>>
> = {
  stewardship_concentration: ['operational_clarity', 'recoverability_confidence'],
  onboarding_survivability: ['onboarding_confidence'],
  modernization_fragility: ['modernization_continuity_confidence'],
  institutional_memory_dependency: ['reconstruction_confidence', 'recoverability_confidence'],
  operational_continuity: ['operational_clarity', 'recoverability_confidence'],
  governance_fragmentation: ['governance_confidence'],
};

function classifyStrength(supportingPatternCount: number): ArchetypeStrength {
  if (supportingPatternCount >= 3) return 'pronounced';
  if (supportingPatternCount === 2) return 'notable';
  return 'observed';
}

export function detectContinuityArchetypes(input: {
  structuralSignals: StructuralContinuitySignal[];
  confidenceSignals: ContinuityConfidenceSignal[];
  dimensionScores?: DimensionScore[];
}): ContinuityArchetypeReading[] {
  const supportCount = new Map<ContinuityArchetypeId, number>();
  for (const s of input.structuralSignals) {
    for (const archetype of s.archetypes) {
      supportCount.set(archetype, (supportCount.get(archetype) ?? 0) + 1);
    }
  }

  const readings: ContinuityArchetypeReading[] = [];
  for (const [archetype, count] of supportCount.entries()) {
    const inputs = ARCHETYPE_CONFIDENCE_INPUTS[archetype] ?? [];
    const relevant = input.confidenceSignals.filter((s) => inputs.includes(s.domain));
    const associatedConfidence =
      relevant.length > 0
        ? relevant.reduce((a, b) => a + b.confidence, 0) / relevant.length
        : null;

    readings.push({
      archetype,
      strength: classifyStrength(count),
      supportingPatternCount: count,
      associatedConfidence,
      description: ARCHETYPE_DESCRIPTIONS[archetype],
    });
  }

  // sort by strength desc, then archetype name for determinism
  const strengthOrdinal: Record<ArchetypeStrength, number> = {
    pronounced: 3,
    notable: 2,
    observed: 1,
  };
  readings.sort((a, b) => {
    const d = strengthOrdinal[b.strength] - strengthOrdinal[a.strength];
    if (d !== 0) return d;
    return a.archetype.localeCompare(b.archetype);
  });
  return readings;
}
