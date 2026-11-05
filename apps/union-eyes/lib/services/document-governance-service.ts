import type { Document } from '@/db/schema/documents-schema';

export type GovernancePrivacyLabel =
  | 'public_internal'
  | 'team_confidential'
  | 'lro_confidential'
  | 'privileged'
  | 'case_restricted'
  | 'highly_sensitive';

export interface DocumentVisibilityContext {
  isOrgMember: boolean;
  isPrimaryOwner: boolean;
  hasCaseAccess: boolean;
  canViewPrivateDocuments: boolean;
  hasExplicitDocumentGrant: boolean;
}

const DEFAULT_CASE_VISIBLE_LABELS = new Set<GovernancePrivacyLabel>([
  'public_internal',
  'team_confidential',
  'case_restricted',
]);

/**
 * Label policy gate used by repository listing, case detail retrieval, and universal search.
 * Results must be filtered before they are returned to the UI.
 *
 * Seniority never widens access: a role label is an eligibility input, not a case relationship. Reading a case's
 * documents needs the case relationship (owner, assignee, collaborator, creator) or an explicit document grant.
 */
export function isDocumentVisibleByPolicy(
  privacyLabel: GovernancePrivacyLabel,
  context: DocumentVisibilityContext,
): boolean {
  if (!context.isOrgMember) {
    return false;
  }

  // Only the case's primary owner reads case documents without a case relationship; organization
  // role seniority (steward, chief steward, officer) is deliberately not an input here.
  if (context.isPrimaryOwner) {
    return true;
  }

  if (!context.hasCaseAccess) {
    return false;
  }

  if (DEFAULT_CASE_VISIBLE_LABELS.has(privacyLabel)) {
    return true;
  }

  if (privacyLabel === 'lro_confidential') {
    return context.canViewPrivateDocuments;
  }

  return context.hasExplicitDocumentGrant;
}

export interface SearchableDocument {
  id: string;
  title?: string | null;
  name?: string | null;
  filename?: string | null;
  privacyLabel?: GovernancePrivacyLabel | null;
  documentType?: string | null;
  uploadedBy?: string | null;
  createdAt?: Date | null;
}

export function normalizeDocumentTitle(document: SearchableDocument): string {
  return (
    document.title ||
    document.filename ||
    document.name ||
    'Untitled document'
  );
}

export function toGovernanceLabel(document: Partial<Document>): GovernancePrivacyLabel {
  return (document.privacyLabel as GovernancePrivacyLabel) || 'team_confidential';
}
