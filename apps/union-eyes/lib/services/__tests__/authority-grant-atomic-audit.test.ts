import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  tx: { insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

const authority = {
  id: 'a1', organizationId: 'org_1', matterId: 'mt1', matterType: 'case', representedPersonId: 'p1',
  representativeUserId: 'r1', representativeOrganizationId: 'org_2', status: 'active',
};
const grant = {
  id: 'g1', organizationId: 'org_1', userId: 'u2', matterId: 'mt1', documentId: 'd1', authorityId: 'a1',
  matterGrantId: 'mg1', representativeOrganizationId: 'org_2', matterType: 'case', grantedBy: 'u1',
};

function stubWrites(row: Record<string, unknown> | null) {
  m.tx.insert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [row]) })) }));
  m.tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => (row ? [row] : [])) })) })) }));
}

describe('representation authority and external document grant lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn(m.tx));
  });

  it('creates a representation authority and audits inside the organization-scoped transaction', async () => {
    stubWrites(authority);
    const { createRepresentationAuthority } = await import('../representation-authority-service');
    await createRepresentationAuthority({ ...authority, createdBy: 'u1' } as never);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      organizationId: 'org_1', userId: 'u1', resourceId: 'a1',
    }));
  });

  it('does not audit a revocation that matched no authority in the organization', async () => {
    stubWrites(null);
    const { revokeRepresentationAuthority } = await import('../representation-authority-service');
    const result = await revokeRepresentationAuthority({ authorityId: 'a1', organizationId: 'org_1', actorId: 'u1' });
    expect(result).toBeNull();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('propagates an audit failure so the authority change cannot commit unaudited', async () => {
    stubWrites(authority);
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { activateRepresentationAuthority } = await import('../representation-authority-service');
    await expect(activateRepresentationAuthority({ authorityId: 'a1', organizationId: 'org_1', actorId: 'u1' }))
      .rejects.toThrow('audit write failed');
  });

  it('revokes an external document grant and audits it in the same transaction', async () => {
    stubWrites(grant);
    const { revokeExternalDocumentGrant } = await import('../external-document-grant-service');
    await revokeExternalDocumentGrant({ grantId: 'g1', organizationId: 'org_1', actorId: 'u1' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'external_document_grant.revoked', organizationId: 'org_1', userId: 'u1', resourceId: 'g1',
    }));
  });

  it('creates a grant only when the grantor can view and share, and audits atomically', async () => {
    stubWrites(grant);
    const { createExternalDocumentGrant } = await import('../external-document-grant-service');
    await expect(createExternalDocumentGrant({ ...grant, grantorCanViewDocument: true, grantorCanShareDocument: false } as never))
      .rejects.toThrow('Grantor is not authorized to share this document');
    expect(m.withRLSContext).not.toHaveBeenCalled();

    await createExternalDocumentGrant({ ...grant, grantorCanViewDocument: true, grantorCanShareDocument: true } as never);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'external_document_grant.created' }));
  });

  it('fails an expiry when the audit record cannot be written', async () => {
    stubWrites(grant);
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { expireExternalDocumentGrant } = await import('../external-document-grant-service');
    await expect(expireExternalDocumentGrant({ grantId: 'g1', organizationId: 'org_1', actorId: 'u1' }))
      .rejects.toThrow('audit write failed');
  });
});
