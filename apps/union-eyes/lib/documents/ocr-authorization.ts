import {
  isDocumentVisibleByPolicy,
  type GovernancePrivacyLabel,
} from '@/lib/services/document-governance-service';

const GOVERNANCE_LABELS: readonly GovernancePrivacyLabel[] = [
  'public_internal',
  'team_confidential',
  'lro_confidential',
  'privileged',
  'case_restricted',
  'highly_sensitive',
];

function asGovernanceLabel(value: string | null): GovernancePrivacyLabel | null {
  return GOVERNANCE_LABELS.find((label) => label === value) ?? null;
}

/**
 * OCR authorization.
 * Case access comes from the kernel. Steward role is not a case decision.
 * A view grant is not permission to extract, correct, or publish text.
 */

export type OcrRelationship =
  | 'unlinked'
  | 'unassigned'
  | 'active'
  | 'revoked'
  | 'expired'
  | 'recused'
  | 'primary_owner';

export type OcrDenial =
  | 'unassigned'
  | 'revoked'
  | 'expired'
  | 'recused'
  | 'classification'
  | 'view_only'
  | 'ocr-transcript-persistence';

export type OcrAuthorizationInput = {
  privacyLabel: string | null;
  relationship: OcrRelationship;
  canViewPrivateDocuments: boolean;
  canUploadDocuments: boolean;
  hasExplicitViewGrant: boolean;
  isUploader: boolean;
};

export function ocrRelationshipFromKernel(input: {
  linked: boolean;
  isPrimaryOwner: boolean;
  canViewCase: boolean;
  recused: boolean;
}): OcrRelationship {
  if (!input.linked) return 'unlinked';
  if (input.recused) return 'recused';
  if (input.isPrimaryOwner) return 'primary_owner';
  if (input.canViewCase) return 'active';
  return 'unassigned';
}

export function authorizeOcrExtraction(
  input: OcrAuthorizationInput,
): { allowed: true } | { allowed: false; reason: OcrDenial } {
  if (input.relationship === 'recused') return { allowed: false, reason: 'recused' };
  if (input.relationship === 'revoked') return { allowed: false, reason: 'revoked' };
  if (input.relationship === 'expired') return { allowed: false, reason: 'expired' };
  if (input.relationship === 'unassigned') return { allowed: false, reason: 'unassigned' };

  const privacyLabel = asGovernanceLabel(input.privacyLabel);
  if (!privacyLabel) return { allowed: false, reason: 'classification' };

  const visible = isDocumentVisibleByPolicy(
    privacyLabel,
    {
      isOrgMember: true,
      isStewardPlus: false,
      isPrimaryOwner: input.relationship === 'primary_owner',
      hasCaseAccess:
        input.relationship === 'unlinked'
        || input.relationship === 'active'
        || input.relationship === 'primary_owner',
      canViewPrivateDocuments: input.canViewPrivateDocuments,
      hasExplicitDocumentGrant: input.hasExplicitViewGrant,
    },
  );
  if (!visible) return { allowed: false, reason: 'classification' };

  if (input.relationship === 'unlinked') {
    if (!input.isUploader) return { allowed: false, reason: 'view_only' };
    return { allowed: true };
  }

  if (input.relationship !== 'primary_owner' && !input.canUploadDocuments) {
    return { allowed: false, reason: 'view_only' };
  }
  return { allowed: true };
}

/** Reviewed transcription and evidence publication stay closed until the canonical write exists. */
export function authorizeTranscriptCorrection(): { allowed: false; reason: 'ocr-transcript-persistence' } {
  return { allowed: false, reason: 'ocr-transcript-persistence' };
}

export function authorizeEvidencePublication(): { allowed: false; reason: 'ocr-transcript-persistence' } {
  return { allowed: false, reason: 'ocr-transcript-persistence' };
}
