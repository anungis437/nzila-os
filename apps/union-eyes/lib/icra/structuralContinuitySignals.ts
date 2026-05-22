/**
 * Structural Continuity Signals — multiple_choice modality interpretation.
 *
 * These signals translate structural-pattern answers into recognizable
 * institutional continuity topologies. They are not scores; they surface
 * the pattern an institution operates under for archetype detection.
 *
 * Doctrine source: docs/oci/assessment/OCI_MODALITY_DOCTRINE.md §5
 */

import type { Answer, ContinuityArchetypeId, Question } from './types';

export type StructuralPatternId =
  // operational knowledge transfer
  | 'transfer_documented'
  | 'transfer_shadowing'
  | 'transfer_committee'
  | 'transfer_mentorship'
  | 'transfer_escalation'
  | 'transfer_undocumented'
  | 'transfer_reconstructed'
  // governance escalation
  | 'escalation_documented'
  | 'escalation_committee'
  | 'escalation_individual'
  | 'escalation_ambiguous'
  // continuity ownership
  | 'ownership_distributed'
  | 'ownership_concentrated'
  | 'ownership_unassigned'
  | 'ownership_rotational'
  // modernization pathway
  | 'modernization_continuity_preserving'
  | 'modernization_capability_first'
  | 'modernization_reactive'
  // onboarding inheritance
  | 'onboarding_structured_inheritance'
  | 'onboarding_observational'
  | 'onboarding_self_directed';

export interface StructuralContinuitySignal {
  pattern: StructuralPatternId;
  sourceQuestionId: string;
  archetypes: ContinuityArchetypeId[];
}

/**
 * Pattern → archetype mapping. Authored deliberately. A single pattern can
 * contribute evidence to multiple archetypes.
 */
const PATTERN_ARCHETYPES: Record<StructuralPatternId, ContinuityArchetypeId[]> = {
  transfer_documented: ['operational_continuity'],
  transfer_shadowing: ['onboarding_survivability'],
  transfer_committee: ['operational_continuity'],
  transfer_mentorship: ['onboarding_survivability'],
  transfer_escalation: ['stewardship_concentration', 'institutional_memory_dependency'],
  transfer_undocumented: ['institutional_memory_dependency'],
  transfer_reconstructed: ['institutional_memory_dependency', 'modernization_fragility'],

  escalation_documented: ['operational_continuity'],
  escalation_committee: ['operational_continuity'],
  escalation_individual: ['stewardship_concentration', 'governance_fragmentation'],
  escalation_ambiguous: ['governance_fragmentation'],

  ownership_distributed: ['operational_continuity'],
  ownership_concentrated: ['stewardship_concentration'],
  ownership_unassigned: ['governance_fragmentation', 'institutional_memory_dependency'],
  ownership_rotational: ['operational_continuity', 'onboarding_survivability'],

  modernization_continuity_preserving: ['operational_continuity'],
  modernization_capability_first: ['modernization_fragility'],
  modernization_reactive: ['modernization_fragility', 'institutional_memory_dependency'],

  onboarding_structured_inheritance: ['onboarding_survivability', 'operational_continuity'],
  onboarding_observational: ['onboarding_survivability'],
  onboarding_self_directed: ['institutional_memory_dependency'],
};

/**
 * Option value → pattern mapping, keyed by question id.
 * Authored alongside question creation in questions.ts.
 */
export const QUESTION_OPTION_PATTERNS: Record<string, Record<string, StructuralPatternId>> = {
  scs_01: {
    documented: 'transfer_documented',
    shadowing: 'transfer_shadowing',
    committee: 'transfer_committee',
    mentorship: 'transfer_mentorship',
    escalation: 'transfer_escalation',
    undocumented: 'transfer_undocumented',
    reconstructed: 'transfer_reconstructed',
  },
  scs_02: {
    documented: 'escalation_documented',
    committee: 'escalation_committee',
    individual: 'escalation_individual',
    ambiguous: 'escalation_ambiguous',
  },
  scs_03: {
    distributed: 'ownership_distributed',
    concentrated: 'ownership_concentrated',
    unassigned: 'ownership_unassigned',
    rotational: 'ownership_rotational',
  },
  scs_04: {
    continuity_preserving: 'modernization_continuity_preserving',
    capability_first: 'modernization_capability_first',
    reactive: 'modernization_reactive',
  },
  scs_05: {
    structured: 'onboarding_structured_inheritance',
    observational: 'onboarding_observational',
    self_directed: 'onboarding_self_directed',
  },
};

export function deriveStructuralSignals(
  answers: Answer[],
  questions: ReadonlyArray<Question>,
): StructuralContinuitySignal[] {
  const signals: StructuralContinuitySignal[] = [];
  const qIndex = new Map(questions.map((q) => [q.id, q]));

  for (const a of answers) {
    const q = qIndex.get(a.questionId);
    if (!q || q.type !== 'multiple_choice') continue;
    const mapping = QUESTION_OPTION_PATTERNS[q.id];
    if (!mapping) continue;
    const pattern = mapping[String(a.rawValue)];
    if (!pattern) continue;
    signals.push({
      pattern,
      sourceQuestionId: q.id,
      archetypes: PATTERN_ARCHETYPES[pattern] ?? [],
    });
  }
  return signals;
}
