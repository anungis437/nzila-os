import { describe, expect, it } from 'vitest';

import { isDocumentVisibleByPolicy, type GovernancePrivacyLabel } from './document-governance-service';

type LiunaActor = {
  name: string;
  context: Parameters<typeof isDocumentVisibleByPolicy>[1];
};

const restrictedLabels: GovernancePrivacyLabel[] = [
  'lro_confidential',
  'privileged',
  'highly_sensitive',
];

const allLabels: GovernancePrivacyLabel[] = [
  'public_internal',
  'team_confidential',
  'case_restricted',
  ...restrictedLabels,
];

const actors: Record<string, LiunaActor> = {
  unaffiliatedExternal: {
    name: 'external participant without org membership',
    context: {
      isOrgMember: false,
      isPrimaryOwner: false,
      hasCaseAccess: false,
      canViewPrivateDocuments: false,
      hasExplicitDocumentGrant: false,
    },
  },
  localMemberWithoutCaseAccess: {
    name: 'local member without case access',
    context: {
      isOrgMember: true,
      isPrimaryOwner: false,
      hasCaseAccess: false,
      canViewPrivateDocuments: false,
      hasExplicitDocumentGrant: false,
    },
  },
  successorReviewer: {
    name: 'successor reviewer with case access only',
    context: {
      isOrgMember: true,
      isPrimaryOwner: false,
      hasCaseAccess: true,
      canViewPrivateDocuments: false,
      hasExplicitDocumentGrant: false,
    },
  },
  seniorOfficerWithoutCaseRelationship: {
    name: 'senior officer with no relationship to the case, holding a stray document grant',
    context: {
      isOrgMember: true,
      isPrimaryOwner: false,
      hasCaseAccess: false,
      canViewPrivateDocuments: false,
      hasExplicitDocumentGrant: true,
    },
  },
  explicitlyGrantedReviewer: {
    name: 'reviewer with explicit document grant',
    context: {
      isOrgMember: true,
      isPrimaryOwner: false,
      hasCaseAccess: true,
      canViewPrivateDocuments: false,
      hasExplicitDocumentGrant: true,
    },
  },
  privateDocumentReviewer: {
    name: 'reviewer with private-document grant',
    context: {
      isOrgMember: true,
      isPrimaryOwner: false,
      hasCaseAccess: true,
      canViewPrivateDocuments: true,
      hasExplicitDocumentGrant: false,
    },
  },
  primaryOwner: {
    name: 'primary owner',
    context: {
      isOrgMember: true,
      isPrimaryOwner: true,
      hasCaseAccess: true,
      canViewPrivateDocuments: false,
      hasExplicitDocumentGrant: false,
    },
  },
};

describe('document governance service', () => {
  it('denies non-members and case outsiders across restricted labels', () => {
    for (const label of restrictedLabels) {
      expect(isDocumentVisibleByPolicy(label, actors.unaffiliatedExternal.context)).toBe(false);
      expect(isDocumentVisibleByPolicy(label, actors.localMemberWithoutCaseAccess.context)).toBe(false);
    }
  });

  it('allows successor case reviewers only to default case-visible records', () => {
    expect(isDocumentVisibleByPolicy('case_restricted', actors.successorReviewer.context)).toBe(true);
    expect(isDocumentVisibleByPolicy('team_confidential', actors.successorReviewer.context)).toBe(true);
    expect(isDocumentVisibleByPolicy('lro_confidential', actors.successorReviewer.context)).toBe(false);
    expect(isDocumentVisibleByPolicy('privileged', actors.successorReviewer.context)).toBe(false);
    expect(isDocumentVisibleByPolicy('highly_sensitive', actors.successorReviewer.context)).toBe(false);
  });

  it('seniority is not a case relationship: a senior officer without one reads no case document of any label, even with a stray grant', () => {
    for (const label of allLabels) {
      expect(isDocumentVisibleByPolicy(label, actors.seniorOfficerWithoutCaseRelationship.context), label).toBe(false);
    }
  });

  it('requires explicit grant or primary ownership for privileged labels', () => {
    for (const label of ['privileged', 'highly_sensitive'] as GovernancePrivacyLabel[]) {
      expect(isDocumentVisibleByPolicy(label, actors.explicitlyGrantedReviewer.context)).toBe(true);
      expect(isDocumentVisibleByPolicy(label, actors.privateDocumentReviewer.context)).toBe(false);
      expect(isDocumentVisibleByPolicy(label, actors.primaryOwner.context)).toBe(true);
    }

    expect(isDocumentVisibleByPolicy('lro_confidential', actors.privateDocumentReviewer.context)).toBe(true);
  });
});
