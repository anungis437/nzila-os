import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => {
  class VerifiedDependencyInputError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
    }
  }
  return {
    reviewVerifiedDependency: vi.fn(),
    reverifyVerifiedDependency: vi.fn(),
    revokeVerifiedDependency: vi.fn(),
    hasMinRole: vi.fn(),
    VerifiedDependencyInputError,
  };
});

vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  reviewVerifiedDependency: m.reviewVerifiedDependency,
  reverifyVerifiedDependency: m.reverifyVerifiedDependency,
  revokeVerifiedDependency: m.revokeVerifiedDependency,
  VerifiedDependencyInputError: m.VerifiedDependencyInputError,
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const make = (status: number) => (message: string, details?: unknown) => Object.assign(new Error(message), { status, details });
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: { forbidden: make(403), conflict: make(409), badRequest: make(400) },
  };
});

const ORG = 'org-1';

async function callPatch(id: string, body: Record<string, unknown>, userId = 'reviewer-1') {
  const { PATCH } = await import('../[id]/route');
  return (PATCH as unknown as (ctx: unknown) => Promise<unknown>)({ params: { id }, organizationId: ORG, userId, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.hasMinRole.mockResolvedValue(true);
});

describe('PATCH /api/exit-interviews/verified-dependencies/[id]', () => {
  it('refuses a reviewer below national_officer before touching the store', async () => {
    m.hasMinRole.mockResolvedValue(false);
    await expect(callPatch('vd1', { action: 'verify' })).rejects.toMatchObject({ status: 403 });
    expect(m.reviewVerifiedDependency).not.toHaveBeenCalled();
    expect(m.revokeVerifiedDependency).not.toHaveBeenCalled();
    await expect(callPatch('vd1', { action: 'reverify', externalAttestation: 'x' })).rejects.toMatchObject({ status: 403 });
    expect(m.reverifyVerifiedDependency).not.toHaveBeenCalled();
  });

  it('verifies a pending submission', async () => {
    const record = { id: 'vd1', status: 'verified' };
    m.reviewVerifiedDependency.mockResolvedValue(record);
    const result = await callPatch('vd1', { action: 'verify', reviewNotes: 'confirmed with finance' }, 'reviewer-1');
    expect(m.reviewVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'verified', 'reviewer-1', 'confirmed with finance', undefined);
    expect(result).toEqual({ data: record });
  });

  it('passes the reviewer\'s external attestation through to verification', async () => {
    m.reviewVerifiedDependency.mockResolvedValue({ id: 'vd1', status: 'verified' });
    await callPatch('vd1', { action: 'verify', externalAttestation: 'read clause 14.2' }, 'reviewer-1');
    expect(m.reviewVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'verified', 'reviewer-1', undefined, { attestation: 'read clause 14.2' });
  });

  it('answers a missing attestation with 400 and an unresolvable node with 409', async () => {
    m.reviewVerifiedDependency.mockRejectedValue(new m.VerifiedDependencyInputError('attestation required', 'attestation_required'));
    await expect(callPatch('vd1', { action: 'verify' })).rejects.toMatchObject({ status: 400, details: { code: 'attestation_required' } });
    m.reviewVerifiedDependency.mockRejectedValue(new m.VerifiedDependencyInputError('ambiguous', 'node_reference_ambiguous'));
    await expect(callPatch('vd1', { action: 'verify', externalAttestation: 'x' })).rejects.toMatchObject({ status: 409, details: { code: 'node_reference_ambiguous' } });
  });

  it('re-verifies a stale verified record with the reviewer\'s attestation', async () => {
    const record = { id: 'vd1', status: 'verified' };
    m.reverifyVerifiedDependency.mockResolvedValue(record);
    const result = await callPatch('vd1', { action: 'reverify', reviewNotes: 'rename confirmed', externalAttestation: 'checked' }, 'reviewer-2');
    expect(m.reverifyVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'reviewer-2', 'rename confirmed', { attestation: 'checked' });
    expect(m.reviewVerifiedDependency).not.toHaveBeenCalled();
    expect(result).toEqual({ data: record });
  });

  it('reports a conflict when re-verification does not apply (already current, concurrent, or the submitter)', async () => {
    m.reverifyVerifiedDependency.mockResolvedValue(null);
    await expect(callPatch('vd1', { action: 'reverify' })).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a pending submission', async () => {
    m.reviewVerifiedDependency.mockResolvedValue({ id: 'vd1', status: 'rejected' });
    await callPatch('vd1', { action: 'reject' }, 'reviewer-1');
    expect(m.reviewVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'rejected', 'reviewer-1', undefined, undefined);
  });

  it('reports a conflict when the review is no longer applicable (already decided, or reviewer is the submitter)', async () => {
    m.reviewVerifiedDependency.mockResolvedValue(null);
    await expect(callPatch('vd1', { action: 'verify' })).rejects.toMatchObject({ status: 409 });
  });

  it('revokes a currently-verified record', async () => {
    const record = { id: 'vd1', status: 'revoked' };
    m.revokeVerifiedDependency.mockResolvedValue(record);
    const result = await callPatch('vd1', { action: 'revoke', reviewNotes: 'process retired' }, 'reviewer-1');
    expect(m.revokeVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'reviewer-1', 'process retired');
    expect(result).toEqual({ data: record });
  });

  it('reports a conflict when revoking a record that is not currently verified', async () => {
    m.revokeVerifiedDependency.mockResolvedValue(null);
    await expect(callPatch('vd1', { action: 'revoke' })).rejects.toMatchObject({ status: 409 });
  });
});
