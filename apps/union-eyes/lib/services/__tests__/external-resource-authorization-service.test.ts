import { describe, expect, it } from 'vitest';
import {
  evaluateExternalDocumentAccess,
  evaluateExternalMatterAccess,
} from '../external-resource-authorization-service';
import type {
  ExternalDocumentAccessGrant,
  ExternalMatterAccessGrant,
  RepresentationAuthority,
} from '@/db/schema/representation-authority-schema';

const NOW = new Date('2026-09-15T12:00:00.000Z');

function authority(overrides: Partial<RepresentationAuthority> = {}): RepresentationAuthority {
  return {
    id: 'authority-a',
    organizationId: 'union-org',
    matterType: 'grievance',
    matterId: 'matter-a',
    representedPersonId: 'member-a',
    representativeUserId: 'professional-a',
    representativeOrganizationId: 'specialist-org',
    scope: ['view', 'documents'],
    source: 'recorded_authority',
    status: 'active',
    effectiveAt: new Date('2026-09-01T00:00:00.000Z'),
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    revokedAt: null,
    revokedBy: null,
    supersededByAuthorityId: null,
    evidenceDocumentId: null,
    createdBy: 'grantor-a',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    metadata: {},
    ...overrides,
  };
}

function matterGrant(overrides: Partial<ExternalMatterAccessGrant> = {}): ExternalMatterAccessGrant {
  return {
    id: 'matter-grant-a',
    authorityId: 'authority-a',
    organizationId: 'union-org',
    matterType: 'grievance',
    matterId: 'matter-a',
    userId: 'professional-a',
    representativeOrganizationId: 'specialist-org',
    status: 'active',
    canView: true,
    canComment: false,
    canUploadDocuments: true,
    canViewDocuments: true,
    canDownloadDocuments: true,
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    revokedAt: null,
    revokedBy: null,
    grantedBy: 'grantor-a',
    grantedAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

function documentGrant(overrides: Partial<ExternalDocumentAccessGrant> = {}): ExternalDocumentAccessGrant {
  return {
    id: 'document-grant-a',
    authorityId: 'authority-a',
    matterGrantId: 'matter-grant-a',
    organizationId: 'union-org',
    matterType: 'grievance',
    matterId: 'matter-a',
    documentId: 'document-a',
    userId: 'professional-a',
    representativeOrganizationId: 'specialist-org',
    status: 'active',
    canView: true,
    canDownload: true,
    canShare: false,
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    revokedAt: null,
    revokedBy: null,
    grantedBy: 'grantor-a',
    grantedAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('external resource authorization', () => {
  it('allows exact-authority exact-matter exact-permission access', () => {
    const decision = evaluateExternalMatterAccess({
      actor: { userId: 'professional-a', representativeOrganizationId: 'specialist-org' },
      organizationId: 'union-org',
      matterType: 'grievance',
      matterId: 'matter-a',
      requiredPermission: 'view',
      authority: authority(),
      matterGrant: matterGrant(),
      now: NOW,
    });

    expect(decision).toEqual(expect.objectContaining({ allowed: true, reason: 'allowed' }));
  });

  it.each([
    ['revoked authority', authority({ revokedAt: NOW, status: 'revoked' }), matterGrant(), 'authority_invalid'],
    ['expired authority', authority({ expiresAt: new Date('2026-09-01T00:00:00.000Z') }), matterGrant(), 'authority_invalid'],
    ['revoked matter grant', authority(), matterGrant({ revokedAt: NOW, status: 'revoked' }), 'matter_grant_invalid'],
    ['expired matter grant', authority(), matterGrant({ expiresAt: new Date('2026-09-01T00:00:00.000Z') }), 'matter_grant_invalid'],
    ['superseded authority', authority({ status: 'superseded' }), matterGrant(), 'authority_invalid'],
  ])('denies request-time access for %s', (_name, auth, grant, reason) => {
    const decision = evaluateExternalMatterAccess({
      actor: { userId: 'professional-a', representativeOrganizationId: 'specialist-org' },
      organizationId: 'union-org',
      matterType: 'grievance',
      matterId: 'matter-a',
      requiredPermission: 'view',
      authority: auth,
      matterGrant: grant,
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe(reason);
  });

  it.each([
    ['right specialist / wrong matter', 'professional-a', 'union-org', 'matter-b'],
    ['right matter / wrong specialist', 'professional-b', 'union-org', 'matter-a'],
    ['right specialist / wrong organization', 'professional-a', 'union-org-b', 'matter-a'],
  ])('denies wrong-scope access: %s', (_name, userId, organizationId, matterId) => {
    const decision = evaluateExternalMatterAccess({
      actor: { userId, representativeOrganizationId: 'specialist-org' },
      organizationId,
      matterType: 'grievance',
      matterId,
      requiredPermission: 'view',
      authority: authority(),
      matterGrant: matterGrant(),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it('does not let a specialist-organization admin inherit professional file access', () => {
    const decision = evaluateExternalMatterAccess({
      actor: { userId: 'specialist-admin-b', representativeOrganizationId: 'specialist-org' },
      organizationId: 'union-org',
      matterType: 'grievance',
      matterId: 'matter-a',
      requiredPermission: 'view',
      authority: authority(),
      matterGrant: matterGrant(),
      now: NOW,
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: false,
      reason: 'authority_invalid',
    }));
  });

  it('requires document grant to match the same authority, matter grant, matter, document and user', () => {
    const decision = evaluateExternalDocumentAccess({
      actor: { userId: 'professional-a', representativeOrganizationId: 'specialist-org' },
      organizationId: 'union-org',
      matterType: 'grievance',
      matterId: 'matter-a',
      documentId: 'document-b',
      requiredPermission: 'download',
      authority: authority(),
      matterGrant: matterGrant(),
      documentGrant: documentGrant({ documentId: 'document-a' }),
      now: NOW,
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: false,
      reason: 'document_grant_invalid',
    }));
  });

  it('denies document download when document grant is view-only', () => {
    const decision = evaluateExternalDocumentAccess({
      actor: { userId: 'professional-a', representativeOrganizationId: 'specialist-org' },
      organizationId: 'union-org',
      matterType: 'grievance',
      matterId: 'matter-a',
      documentId: 'document-a',
      requiredPermission: 'download',
      authority: authority(),
      matterGrant: matterGrant(),
      documentGrant: documentGrant({ canDownload: false }),
      now: NOW,
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: false,
      reason: 'permission_missing',
    }));
  });
});
