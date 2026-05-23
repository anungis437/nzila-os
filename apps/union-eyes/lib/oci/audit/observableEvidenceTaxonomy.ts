/**
 * ARTIFACT TYPE: IP / Module
 * MODULE: lib/oci/audit/observableEvidenceTaxonomy
 * DOCTRINE_VERSION: 1.0.0
 *
 * Canonical taxonomy describing what each evidence type means and how
 * reviewers should weight it. The taxonomy is frozen; no AI generates
 * categories; humans choose, the system records.
 */

import type { EvidenceType, EvidenceStrength } from './entropyAuditContracts';
import { EVIDENCE_TYPES } from './entropyAuditContracts';

interface TaxonomyEntry {
  readonly evidenceType: EvidenceType;
  readonly description: string;
  readonly examples: ReadonlyArray<string>;
  /** Base weight in [0,1] used by the sufficiency engine. */
  readonly baseWeight: number;
}

const TAXONOMY: Readonly<Record<EvidenceType, TaxonomyEntry>> = Object.freeze({
  Documentary: Object.freeze({
    evidenceType: 'Documentary',
    description: 'Reviewable artefacts that demonstrate role, succession, or governance state.',
    examples: Object.freeze(['delegation registers', 'succession charts', 'role mandates']),
    baseWeight: 0.9,
  }),
  Procedural: Object.freeze({
    evidenceType: 'Procedural',
    description: 'Documented and followed institutional procedures observed in action.',
    examples: Object.freeze(['decision logs', 'standing process records']),
    baseWeight: 0.8,
  }),
  Historical: Object.freeze({
    evidenceType: 'Historical',
    description: 'Demonstrated continuity-through-event evidence (modernization, leadership change).',
    examples: Object.freeze(['transition retrospectives', 'continuity post-mortems']),
    baseWeight: 0.75,
  }),
  Operational: Object.freeze({
    evidenceType: 'Operational',
    description: 'Live operational signals captured through reviewer-observed practice.',
    examples: Object.freeze(['cross-coverage observed', 'load-bearing handoff observed']),
    baseWeight: 0.7,
  }),
  Transitional: Object.freeze({
    evidenceType: 'Transitional',
    description: 'Evidence captured during active transitions; explicitly higher uncertainty.',
    examples: Object.freeze(['mid-modernization snapshots', 'leadership change windows']),
    baseWeight: 0.55,
  }),
  Governance: Object.freeze({
    evidenceType: 'Governance',
    description: 'Board, council, or policy-body documentation of structure and responsibility.',
    examples: Object.freeze(['board minutes', 'policy approvals', 'governance charters']),
    baseWeight: 0.85,
  }),
  CrossFunctional: Object.freeze({
    evidenceType: 'CrossFunctional',
    description: 'Multiple independent reviewers across functions converging on a finding.',
    examples: Object.freeze(['joint reviewer findings', 'inter-team confirmations']),
    baseWeight: 0.8,
  }),
  Verbal: Object.freeze({
    evidenceType: 'Verbal',
    description: 'Reviewer-reported verbal context; never sufficient on its own.',
    examples: Object.freeze(['interview summaries', 'committee testimony notes']),
    baseWeight: 0.3,
  }),
});

export function describeEvidence(type: EvidenceType): TaxonomyEntry {
  return TAXONOMY[type];
}

export function strengthMultiplier(strength: EvidenceStrength): number {
  switch (strength) {
    case 'strong':
      return 1.0;
    case 'moderate':
      return 0.7;
    case 'weak':
      return 0.4;
    case 'circumstantial':
      return 0.2;
  }
}

export const EVIDENCE_TAXONOMY = TAXONOMY;
export { EVIDENCE_TYPES };
