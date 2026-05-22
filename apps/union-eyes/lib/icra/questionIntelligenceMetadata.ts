/**
 * Question Intelligence Metadata — canonical registry.
 *
 * Provides default-safe intelligence metadata for legacy v2 maturity
 * questions that pre-date the metadata field, plus helpers to retrieve
 * effective metadata for any question.
 *
 * Doctrine source: docs/oci/assessment/OCI_QUESTION_ARCHITECTURE.md
 */

import type {
  IntelligenceContribution,
  Question,
  QuestionIntelligenceMetadata,
  SectionId,
} from './types';

/**
 * Section-default intelligence contributions, used to backfill metadata
 * for legacy maturity questions that did not declare their own.
 */
const SECTION_DEFAULT_CONTRIBUTIONS: Record<SectionId, IntelligenceContribution[]> = {
  organizational_context: ['continuity_maturity'],
  operational_dependency: ['continuity_maturity', 'recoverability_confidence'],
  governance_visibility: ['governance_sophistication'],
  institutional_memory: ['continuity_maturity', 'reconstruction_confidence'],
  transition_readiness: ['onboarding_confidence', 'continuity_maturity'],
  operational_coordination: ['operational_clarity', 'continuity_maturity'],
  explainability_trust: ['governance_sophistication'],
  sovereignty_governance: ['governance_sophistication', 'modernization_continuity'],
};

const DEFAULT_MATURITY_METADATA = (section: SectionId): QuestionIntelligenceMetadata => ({
  modalityRole: 'maturity_ladder',
  intelligenceContribution: SECTION_DEFAULT_CONTRIBUTIONS[section] ?? ['continuity_maturity'],
  longitudinalValue: 'medium',
  stabilizationRelevance: section === 'governance_visibility' ? 'governance_replay' : 'not_applicable',
  runtimeRelevance: section === 'operational_dependency' ? 'incident_continuity' : 'not_applicable',
  intelligenceNetworkRelevance: 'medium',
  confidenceSensitivity: false,
  governanceSensitivity:
    section === 'governance_visibility' ||
    section === 'explainability_trust' ||
    section === 'sovereignty_governance',
});

/**
 * Return effective intelligence metadata for a question. If the question
 * declares metadata, return it. Otherwise return a section-default profile
 * appropriate to the question's section. Never returns undefined.
 */
export function getQuestionIntelligenceMetadata(
  question: Question,
): QuestionIntelligenceMetadata {
  if (question.intelligence) return question.intelligence;
  if (question.type === 'maturity_select') {
    return DEFAULT_MATURITY_METADATA(question.section);
  }
  // likert_5 and multiple_choice questions in bank version >=3 MUST
  // declare metadata; this fallback exists only to keep the type total.
  return DEFAULT_MATURITY_METADATA(question.section);
}

/**
 * Validate that a question has the metadata required by bank version 3.
 * Returns the list of missing/invalid fields. Empty array = valid.
 */
export function validateQuestionMetadata(question: Question): string[] {
  const issues: string[] = [];
  const m = question.intelligence;
  if (!m) {
    if (question.type !== 'maturity_select') {
      issues.push('missing-intelligence-metadata');
    }
    return issues;
  }
  // modality-role / type consistency
  if (question.type === 'maturity_select' && m.modalityRole !== 'maturity_ladder') {
    issues.push('modality-role-mismatch');
  }
  if (
    question.type === 'likert_5' &&
    m.modalityRole !== 'confidence_sensing' &&
    m.modalityRole !== 'ambiguity_sensing'
  ) {
    issues.push('modality-role-mismatch');
  }
  if (
    question.type === 'multiple_choice' &&
    m.modalityRole !== 'structural_pattern' &&
    m.modalityRole !== 'inheritance_pattern' &&
    m.modalityRole !== 'topology_pattern'
  ) {
    issues.push('modality-role-mismatch');
  }
  // contribution cardinality
  if (m.intelligenceContribution.length === 0) {
    issues.push('empty-intelligence-contribution');
  }
  if (m.intelligenceContribution.length > 2) {
    issues.push('over-declared-intelligence-contribution');
  }
  return issues;
}
