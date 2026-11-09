import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  reviewVerifiedDependency: vi.fn(),
  revokeVerifiedDependency: vi.fn(),
  hasMinRole: vi.fn(),
}));

vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  reviewVerifiedDependency: m.reviewVerifiedDependency,
  revokeVerifiedDependency: m.revokeVerifiedDependency,
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const make = (status: number) => (message: string) => Object.assign(new Error(message), { status });
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: { forbidden: make(403), conflict: make(409) },
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
  });

  it('verifies a pending submission', async () => {
    const record = { id: 'vd1', status: 'verified' };
    m.reviewVerifiedDependency.mockResolvedValue(record);
    const result = await callPatch('vd1', { action: 'verify', reviewNotes: 'confirmed with finance' }, 'reviewer-1');
    expect(m.reviewVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'verified', 'reviewer-1', 'confirmed with finance');
    expect(result).toEqual({ data: record });
  });

  it('rejects a pending submission', async () => {
    m.reviewVerifiedDependency.mockResolvedValue({ id: 'vd1', status: 'rejected' });
    await callPatch('vd1', { action: 'reject' }, 'reviewer-1');
    expect(m.reviewVerifiedDependency).toHaveBeenCalledWith(ORG, 'vd1', 'rejected', 'reviewer-1', undefined);
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
