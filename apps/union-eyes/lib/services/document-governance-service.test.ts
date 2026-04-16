import { describe, expect, it } from 'vitest';
import {
  isDocumentVisibleByPolicy,
  normalizeDocumentTitle,
  toGovernanceLabel,
} from './document-governance-service';

const baseContext = {
  isOrgMember: true,
  isStewardPlus: false,
  isPrimaryOwner: false,
  hasCaseAccess: true,
  canViewPrivateDocuments: false,
  hasExplicitDocumentGrant: false,
};

describe('isDocumentVisibleByPolicy', () => {
  it('denies all visibility when user is not an org member', () => {
    expect(
      isDocumentVisibleByPolicy('public_internal', {
        ...baseContext,
        isOrgMember: false,
      }),
    ).toBe(false);
  });

  it('allows default labels for case collaborators', () => {
    expect(isDocumentVisibleByPolicy('public_internal', baseContext)).toBe(true);
    expect(isDocumentVisibleByPolicy('team_confidential', baseContext)).toBe(true);
    expect(isDocumentVisibleByPolicy('case_restricted', baseContext)).toBe(true);
  });

  it('denies lro_confidential without private-doc scope', () => {
    expect(isDocumentVisibleByPolicy('lro_confidential', baseContext)).toBe(false);
    expect(
      isDocumentVisibleByPolicy('lro_confidential', {
        ...baseContext,
        canViewPrivateDocuments: true,
      }),
    ).toBe(true);
  });

  it('requires explicit grant for privileged/highly_sensitive collaborators', () => {
    expect(isDocumentVisibleByPolicy('privileged', baseContext)).toBe(false);
    expect(isDocumentVisibleByPolicy('highly_sensitive', baseContext)).toBe(false);
    expect(
      isDocumentVisibleByPolicy('privileged', {
        ...baseContext,
        hasExplicitDocumentGrant: true,
      }),
    ).toBe(true);
  });

  it('allows primary owner except privileged/highly_sensitive without rule-break', () => {
    expect(
      isDocumentVisibleByPolicy('team_confidential', {
        ...baseContext,
        isPrimaryOwner: true,
      }),
    ).toBe(true);
    expect(
      isDocumentVisibleByPolicy('privileged', {
        ...baseContext,
        isPrimaryOwner: true,
      }),
    ).toBe(true);
  });

  it('blocks non-collaborators', () => {
    expect(
      isDocumentVisibleByPolicy('public_internal', {
        ...baseContext,
        hasCaseAccess: false,
      }),
    ).toBe(false);
  });
});

describe('normalizeDocumentTitle', () => {
  it('prefers title then filename then name', () => {
    expect(normalizeDocumentTitle({ id: '1', title: 'Alpha', filename: 'a.pdf', name: 'n' })).toBe('Alpha');
    expect(normalizeDocumentTitle({ id: '2', filename: 'a.pdf', name: 'n' })).toBe('a.pdf');
    expect(normalizeDocumentTitle({ id: '3', name: 'n' })).toBe('n');
    expect(normalizeDocumentTitle({ id: '4' })).toBe('Untitled document');
  });
});

describe('toGovernanceLabel', () => {
  it('defaults to team_confidential when missing', () => {
    expect(toGovernanceLabel({})).toBe('team_confidential');
    expect(toGovernanceLabel({ privacyLabel: 'public_internal' as never })).toBe('public_internal');
  });
});
