import { describe, expect, it } from 'vitest';
import { isDocumentVisibleByPolicy, toGovernanceLabel } from './document-governance-service';

describe('unclassified optional sensitivity metadata does not authorize restricted documents', () => {
  const context = { isOrgMember: true, isPrimaryOwner: false,
    hasCaseAccess: true, canViewPrivateDocuments: false, hasExplicitDocumentGrant: false };

  it.each(['privileged', 'highly_sensitive', 'lro_confidential'] as const)(
    'retains %s denial when legacy optional flags are NULL', (privacyLabel) => {
      const document = { privacyLabel, memberPii: null, medicalSensitive: null, disciplinarySensitive: null };
      expect(isDocumentVisibleByPolicy(toGovernanceLabel(document), context)).toBe(false);
    },
  );

  it('does not grant an external actor access even with an explicit document grant', () => {
    expect(isDocumentVisibleByPolicy('team_confidential', {
      ...context, isOrgMember: false, hasExplicitDocumentGrant: true,
    })).toBe(false);
  });
});
