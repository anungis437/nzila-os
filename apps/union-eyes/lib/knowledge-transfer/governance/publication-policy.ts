import type { ExitInterviewSensitivityLevel } from '@/db/schema';
import { SENSITIVITY_LEVELS, isIndexingAllowed, isPublishAllowed } from './consent-controls';

/**
 * Publication policy for an exit interview.
 *
 * Publishing copies the interview into the organization's knowledge base and hands its text to the AI control plane.
 * Both need the interview's own classification and the retiring employee's consent, and the person who publishes is
 * neither the one who prepared the interview nor the one who reviewed it.
 */
export type PublicationDecision =
  | { allowed: true; copyToKnowledgeBase: boolean; extractExpertise: boolean }
  | { allowed: false; reason: string };

export function decidePublication(input: {
  sensitivityLevel: string | null;
  consentGranted: boolean | null;
  createdBy: string | null;
  reviewedBy: string | null;
  publisher: string;
}): PublicationDecision {
  const level = input.sensitivityLevel as ExitInterviewSensitivityLevel | null;
  if (!level || !(level in SENSITIVITY_LEVELS)) {
    return { allowed: false, reason: 'A sensitivity level must be recorded before an interview is published' };
  }
  if (input.consentGranted !== true) {
    return { allowed: false, reason: 'The retiring employee\u2019s consent must be recorded before an interview is published' };
  }
  if (!isPublishAllowed(level, true)) {
    return { allowed: false, reason: 'This sensitivity level cannot be published' };
  }
  if (input.publisher === input.createdBy || input.publisher === input.reviewedBy) {
    return { allowed: false, reason: 'An interview is not published by the person who prepared or reviewed it' };
  }
  return {
    allowed: true,
    // Only a level that permits indexing is copied into the shared knowledge base.
    copyToKnowledgeBase: SENSITIVITY_LEVELS[level].indexingAllowed,
    extractExpertise: isIndexingAllowed(level, true),
  };
}
