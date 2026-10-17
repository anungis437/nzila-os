import type { RightsSnapshot } from '../../source-continuity/contracts'
import type { EvidenceReference, RecipientDisposition, RecipientRequirement } from '../contracts'

export const SYNTHETIC_EVIDENCE: EvidenceReference = {
  evidenceId: 'synthetic-evidence-001',
  version: 'v1',
  sourceAuthorityId: 'synthetic-source-authority',
  provenanceRef: 'synthetic-provenance-001',
}

const evaluatedAt = '2026-03-01T12:00:00.000Z'

function rightsFor(recipientId: string): RightsSnapshot {
  return {
    decisionRef: `synthetic-auth-${recipientId}`,
    decidedAt: '2026-02-01T12:00:00.000Z',
    permittedPurposes: [`purpose-${recipientId}`],
    permittedRecipients: [recipientId],
    revocationAuthorityIds: ['synthetic-operator'],
    sourceAccess: 'ALLOWED',
    transientProcessing: 'ALLOWED',
    persistence: 'UNKNOWN',
    transformation: 'UNKNOWN',
    disclosure: 'ALLOWED',
    export: 'UNKNOWN',
    rehydration: 'UNKNOWN',
    deletion: 'UNKNOWN',
    retentionAfterDisconnect: 'UNKNOWN',
  }
}

export const SYNTHETIC_REQUIREMENTS: RecipientRequirement[] = [
  {
    recipientId: 'synthetic-recipient-a',
    requirementRef: 'synthetic-requirement-a',
    requirementVersion: '1',
    purpose: 'purpose-synthetic-recipient-a',
    mappingVersion: 'mapping-1',
    requiredCriterionRefs: ['criterion-status', 'criterion-period'],
    evidenceCriterionStates: { 'criterion-status': 'MET', 'criterion-period': 'MET' },
    rights: rightsFor('synthetic-recipient-a'),
    evaluatedAt,
  },
  {
    recipientId: 'synthetic-recipient-b',
    requirementRef: 'synthetic-requirement-b',
    requirementVersion: '3',
    purpose: 'purpose-synthetic-recipient-b',
    mappingVersion: 'mapping-2',
    requiredCriterionRefs: ['criterion-status', 'criterion-scope'],
    evidenceCriterionStates: { 'criterion-status': 'MET', 'criterion-scope': 'UNKNOWN' },
    rights: rightsFor('synthetic-recipient-b'),
    evaluatedAt,
  },
]

export const SYNTHETIC_DISPOSITIONS: RecipientDisposition[] = [
  {
    recipientId: 'synthetic-recipient-a',
    dispositionRef: 'synthetic-disposition-a',
    authorityRef: 'synthetic-decision-authority-a',
    provenanceRef: 'synthetic-disposition-provenance-a',
    value: 'SYNTHETIC_REVIEW_REQUIRED',
    recordedAt: evaluatedAt,
  },
  {
    recipientId: 'synthetic-recipient-b',
    dispositionRef: 'synthetic-disposition-b',
    authorityRef: 'synthetic-decision-authority-b',
    provenanceRef: 'synthetic-disposition-provenance-b',
    value: 'SYNTHETIC_DEFERRED',
    recordedAt: evaluatedAt,
  },
]
