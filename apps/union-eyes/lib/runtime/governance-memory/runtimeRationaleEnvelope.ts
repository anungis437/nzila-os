/**
 * ARTIFACT TYPE: Runtime Envelope
 * MODULE: OCI Governance Memory Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * Rationale envelope persisted by the Governance Memory Runtime.
 *
 * Posture:
 *   - Rationale is recorded only on reviewer-led action.
 *   - Rationale carries the reviewer's identifier (refId), never a free-form
 *     name or contact.
 *   - Rationale is institution-scoped. Cross-institution reads are not
 *     supported by the contract.
 *   - The runtime never infers rationale; it persists what a reviewer has
 *     stated.
 */

import type {
  GovernanceMemoryReference,
  RuntimeLineageReference,
} from '../contracts/runtimeContracts';

export const GOVERNANCE_MEMORY_ENVELOPE_VERSION = '1.0.0' as const;

export type RationaleSubjectKind = GovernanceMemoryReference['subjectKind'];

export interface RuntimeRationaleEnvelope {
  readonly envelopeVersion: typeof GOVERNANCE_MEMORY_ENVELOPE_VERSION;
  readonly memoryId: string;
  readonly institutionScope: string;
  readonly subjectKind: RationaleSubjectKind;
  readonly subjectRefId: string;
  readonly rationaleStatement: string;
  readonly reviewerRefId: string;
  readonly recordedAt: string; // ISO-8601
  readonly lineage: readonly RuntimeLineageReference[];
}

export function asMemoryReference(
  env: RuntimeRationaleEnvelope,
): GovernanceMemoryReference {
  return {
    memoryId: env.memoryId,
    institutionScope: env.institutionScope,
    recordedAt: env.recordedAt,
    subjectKind: env.subjectKind,
    reviewerRefId: env.reviewerRefId,
  };
}
