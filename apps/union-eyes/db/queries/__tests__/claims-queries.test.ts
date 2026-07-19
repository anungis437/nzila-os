/**
 * Claims Queries — Unit Tests
 *
 * withRLSContext invokes the callback with a fake drizzle-style tx whose
 * builder chains resolve from a controllable queue (Errors reject).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'values', 'set', 'returning']) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    const v = mocks.queue.length ? mocks.queue.shift() : [];
    if (v instanceof Error) return Promise.reject(v).then(resolve, reject);
    return Promise.resolve(v).then(resolve, reject);
  };
  return chain;
}
function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../claims-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

describe('claims-queries', () => {
  beforeEach(() => {
    mocks.queue = [];
    vi.clearAllMocks();
  });

  it('createClaim generates claim number and returns claim', async () => {
    push([{ count: 2 }], [{ claimId: 'c1', claimNumber: 'CASE-X' }]);
    const r = await q.createClaim({ memberId: 'm1', organizationId: 'org' } as never);
    expect(r).toEqual({ claimId: 'c1', claimNumber: 'CASE-X' });
  });

  it('createClaim rethrows on error', async () => {
    push(new Error('fail'));
    await expect(q.createClaim({} as never)).rejects.toThrow('Failed to create claim');
  });

  it('getClaimsByMember returns claims / rethrows', async () => {
    push([{ claimId: 'c1' }]);
    expect(await q.getClaimsByMember('m1', 'org')).toHaveLength(1);
    push(new Error('fail'));
    await expect(q.getClaimsByMember('m1', 'org')).rejects.toThrow('Failed to fetch claims');
  });

  it('getClaimsByOrganization with and without limit', async () => {
    push([{ id: 'org-uuid' }], [{ claimId: 'c1' }]);
    expect(await q.getClaimsByOrganization('acme', 10)).toHaveLength(1);
    push([{ id: 'org-uuid' }], [{ claimId: 'c2' }, { claimId: 'c3' }]);
    expect(await q.getClaimsByOrganization('acme')).toHaveLength(2);
  });

  it('getClaimsByOrganization throws when org missing', async () => {
    push([]);
    await expect(q.getClaimsByOrganization('missing')).rejects.toThrow('Failed to fetch claims');
  });

  it('getClaimById returns claim', async () => {
    push([{ claimId: 'c1' }]);
    expect(await q.getClaimById('c1', 'org')).toEqual({ claimId: 'c1' });
  });

  it('updateClaimStatus returns updated + records update (with and without notes)', async () => {
    push([{ claimId: 'c1', status: 'resolved' }], []);
    expect(await q.updateClaimStatus('c1', 'resolved', 'u1', 'org', 'note')).toEqual({ claimId: 'c1', status: 'resolved' });
    push([{ claimId: 'c1', status: 'closed' }], []);
    expect(await q.updateClaimStatus('c1', 'closed', 'u1', 'org')).toEqual({ claimId: 'c1', status: 'closed' });
  });

  it('updateClaimStatus rethrows on error', async () => {
    push(new Error('fail'));
    await expect(q.updateClaimStatus('c1', 'resolved', 'u1', 'org')).rejects.toThrow('Failed to update claim status');
  });

  it('assignClaim returns updated + records assignment', async () => {
    push([{ claimId: 'c1', assignedTo: 'u2' }], []);
    expect(await q.assignClaim('c1', 'u2', 'u1', 'org')).toEqual({ claimId: 'c1', assignedTo: 'u2' });
  });

  it('getClaimsAssignedToUser returns claims / throws when org missing', async () => {
    push([{ id: 'org-uuid' }], [{ claimId: 'c1' }]);
    expect(await q.getClaimsAssignedToUser('u1', 'acme')).toHaveLength(1);
    push([]);
    await expect(q.getClaimsAssignedToUser('u1', 'missing')).rejects.toThrow('Failed to fetch assigned claims');
  });

  it('getClaimStatistics by slug and by UUID', async () => {
    push([{ id: 'org-uuid' }], [{ count: 5 }], [{ count: 3 }], [{ count: 2 }], [{ count: 1 }]);
    const stats = await q.getClaimStatistics('acme');
    expect(stats).toEqual({ activeClaims: 5, pendingReviews: 3, resolvedCases: 2, highPriorityClaims: 1 });

    push([{ id: 'org-uuid' }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }]);
    const stats2 = await q.getClaimStatistics('11111111-1111-1111-1111-111111111111');
    expect(stats2.activeClaims).toBe(0);
  });

  it('getClaimStatistics throws when org missing', async () => {
    push([]);
    await expect(q.getClaimStatistics('missing')).rejects.toThrow('Failed to fetch statistics');
  });

  it('getRecentClaimUpdates returns updates', async () => {
    push([{ id: 'u1' }]);
    expect(await q.getRecentClaimUpdates('c1')).toHaveLength(1);
  });

  it('addClaimUpdate returns new update (default + custom type)', async () => {
    push([{ id: 'u1' }], []);
    expect(await q.addClaimUpdate('c1', 'msg', 'u1')).toEqual({ id: 'u1' });
    push([{ id: 'u2' }], []);
    expect(await q.addClaimUpdate('c1', 'msg', 'u1', 'status_change')).toEqual({ id: 'u2' });
  });

  it('deleteClaim soft-closes and returns claim', async () => {
    push([{ claimId: 'c1', status: 'closed' }]);
    expect(await q.deleteClaim('c1')).toEqual({ claimId: 'c1', status: 'closed' });
  });

  it('honors injected tx (if-branch)', async () => {
    push([{ claimId: 'c9' }]);
    expect(await q.getClaimById('c9', 'org', makeTx() as never)).toEqual({ claimId: 'c9' });
  });
});
