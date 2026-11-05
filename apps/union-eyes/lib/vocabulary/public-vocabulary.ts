/**
 * The part of the CUPE vocabulary the API serves.
 *
 * The package's vocabulary also carries service-level hours per priority, escalation, legal and settlement flags per role and severity,
 * and allowed status transitions. Those are the package's v0.1 defaults, not figures an institution has set or approved, and the case
 * state machine reads them server-side from the package. Serving them to every signed-in session presented them as the institution's
 * reference data, so the API serves the labels and identifiers a screen needs and nothing that reads as a commitment.
 */
import type { CUPEVocabulary } from '@nzila/cupe-vocabulary';

export interface PublicVocabulary {
  caseTypes: Array<{ id: string; label: string; description: string }>;
  priorities: Array<{ id: string; label: string }>;
  severities: Array<{ id: string; label: string; description: string }>;
  roles: Array<{ id: string; label: string; description: string }>;
  statuses: Array<{ id: string; label: string; category: string }>;
  lastUpdated: string;
  version: string;
}

export function toPublicVocabulary(vocabulary: CUPEVocabulary): PublicVocabulary {
  return {
    caseTypes: vocabulary.caseTypes.map(({ id, label, description }) => ({ id, label, description })),
    priorities: vocabulary.priorities.map(({ id, label }) => ({ id, label })),
    severities: vocabulary.severities.map(({ id, label, description }) => ({ id, label, description })),
    roles: vocabulary.roles.map(({ id, label, description }) => ({ id, label, description })),
    statuses: vocabulary.statuses.map(({ id, label, category }) => ({ id, label, category })),
    lastUpdated: vocabulary.lastUpdated,
    version: vocabulary.version,
  };
}
