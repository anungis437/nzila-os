/**
 * Institutional Pattern Detection — higher-order pattern inference.
 *
 * Combines archetype readings with dimension scores to surface composite
 * institutional patterns. Calm, descriptive, never accusatory.
 *
 * Doctrine: refusal-default. When evidence is insufficient, returns no
 * pattern rather than fabricating one.
 */

import type { DimensionScore } from './types';
import type { ContinuityArchetypeReading } from './continuityArchetypeSignals';

export type InstitutionalPatternId =
  | 'concentrated_stewardship_high_confidence'
  | 'concentrated_stewardship_low_confidence'
  | 'memory_dependent_onboarding'
  | 'modernization_continuity_gap'
  | 'governance_fragmentation_with_unclear_authority'
  | 'structurally_distributed_continuity';

export interface InstitutionalPattern {
  id: InstitutionalPatternId;
  description: string;
  contributingArchetypes: string[];
  confidence: 'observed' | 'supported' | 'pronounced';
}

const PATTERN_DESCRIPTIONS: Record<InstitutionalPatternId, string> = {
  concentrated_stewardship_high_confidence:
    'Continuity stewardship is concentrated in a small number of people, and confidence in the institution\'s operational clarity remains high. This pattern often precedes sudden discontinuity when those individuals depart.',
  concentrated_stewardship_low_confidence:
    'Continuity stewardship is concentrated in a small number of people, and the institution itself perceives the resulting fragility. Awareness without redistribution is a precursor to burnout.',
  memory_dependent_onboarding:
    'Onboarding relies primarily on observation and informal transfer. New people inherit roles without inheriting context.',
  modernization_continuity_gap:
    'Modernization decisions appear to prioritize capability gains over continuity preservation.',
  governance_fragmentation_with_unclear_authority:
    'Governance authority is unevenly distributed and escalation pathways are not consistently documented.',
  structurally_distributed_continuity:
    'Continuity is structurally distributed across documented mechanisms rather than carried by individuals.',
};

export function detectInstitutionalPatterns(input: {
  archetypeReadings: ContinuityArchetypeReading[];
  dimensionScores?: DimensionScore[];
}): InstitutionalPattern[] {
  const patterns: InstitutionalPattern[] = [];
  const byArchetype = new Map(
    input.archetypeReadings.map((r) => [r.archetype, r] as const),
  );

  const stewardship = byArchetype.get('stewardship_concentration');
  if (stewardship && stewardship.strength !== 'observed') {
    const lowConfidence =
      stewardship.associatedConfidence !== null && stewardship.associatedConfidence < 0.4;
    patterns.push({
      id: lowConfidence
        ? 'concentrated_stewardship_low_confidence'
        : 'concentrated_stewardship_high_confidence',
      description: PATTERN_DESCRIPTIONS[
        lowConfidence
          ? 'concentrated_stewardship_low_confidence'
          : 'concentrated_stewardship_high_confidence'
      ],
      contributingArchetypes: ['stewardship_concentration'],
      confidence: stewardship.strength === 'pronounced' ? 'pronounced' : 'supported',
    });
  }

  const memory = byArchetype.get('institutional_memory_dependency');
  const onboarding = byArchetype.get('onboarding_survivability');
  if (memory && onboarding) {
    patterns.push({
      id: 'memory_dependent_onboarding',
      description: PATTERN_DESCRIPTIONS.memory_dependent_onboarding,
      contributingArchetypes: ['institutional_memory_dependency', 'onboarding_survivability'],
      confidence: 'supported',
    });
  }

  const modernization = byArchetype.get('modernization_fragility');
  if (modernization && modernization.strength !== 'observed') {
    patterns.push({
      id: 'modernization_continuity_gap',
      description: PATTERN_DESCRIPTIONS.modernization_continuity_gap,
      contributingArchetypes: ['modernization_fragility'],
      confidence: modernization.strength === 'pronounced' ? 'pronounced' : 'supported',
    });
  }

  const governance = byArchetype.get('governance_fragmentation');
  if (governance) {
    patterns.push({
      id: 'governance_fragmentation_with_unclear_authority',
      description: PATTERN_DESCRIPTIONS.governance_fragmentation_with_unclear_authority,
      contributingArchetypes: ['governance_fragmentation'],
      confidence: governance.strength === 'pronounced' ? 'pronounced' : 'observed',
    });
  }

  const continuity = byArchetype.get('operational_continuity');
  if (continuity && continuity.strength === 'pronounced' && !stewardship) {
    patterns.push({
      id: 'structurally_distributed_continuity',
      description: PATTERN_DESCRIPTIONS.structurally_distributed_continuity,
      contributingArchetypes: ['operational_continuity'],
      confidence: 'pronounced',
    });
  }

  return patterns;
}
