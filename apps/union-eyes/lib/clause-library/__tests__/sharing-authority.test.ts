import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — shared_clause_library OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain() };
  return { queue, db };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  inArray: vi.fn((col: unknown, val: unknown) => ({ op: 'inArray', col, val })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    { raw: vi.fn() },
  ),
}));
vi.mock('@/db/schema', () => ({
  organizations: { id: 'org.id', organizationType: 'org.organizationType', hierarchyPath: 'org.hierarchyPath', clcAffiliated: 'org.clcAffiliated' },
  congressMemberships: { id: 'cm.id', organizationId: 'cm.organizationId', status: 'cm.status' },
}));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: {
    id: 'scl.id',
    sourceOrganizationId: 'scl.sourceOrganizationId',
    sharingLevel: 'scl.sharingLevel',
    sharedWithOrgIds: 'scl.sharedWithOrgIds',
  },
}));

const pushSel = (...items: unknown[]) => h.queue.push(...items);

describe('isSharedClauseOwner', () => {
  it('is true only for the source organization', async () => {
    const { isSharedClauseOwner } = await import('../sharing-authority');
    expect(isSharedClauseOwner('org-a', { sourceOrganizationId: 'org-a' })).toBe(true);
    expect(isSharedClauseOwner('org-b', { sourceOrganizationId: 'org-a' })).toBe(false);
  });
});

describe('canReadSharedClause', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
  });

  it('owner can always read regardless of sharingLevel', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    const result = await canReadSharedClause('org-a', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'private',
      sharedWithOrgIds: [],
    });
    expect(result).toBe(true);
  });

  it('public sharingLevel is readable by any organization', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'public',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(true);
  });

  it('private sharingLevel is readable only by orgs in the explicit sharedWithOrgIds grant', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    const granted = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'private',
      sharedWithOrgIds: ['org-b'],
    });
    const notGranted = await canReadSharedClause('org-c', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'private',
      sharedWithOrgIds: ['org-b'],
    });
    expect(granted).toBe(true);
    expect(notGranted).toBe(false);
  });

  it('private sharingLevel with no explicit grants denies every non-owner org', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'private',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(false);
  });

  it('unknown/unrecognized sharingLevel fails closed', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'not-a-real-level',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(false);
  });

  it('federation sharingLevel is readable when caller and owner share the same federation ancestor', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    // getFederationAncestorId(callerOrgId='org-b'): self lookup -> not a federation -> ancestor lookup
    pushSel([{ id: 'org-b', organizationType: 'union', hierarchyPath: ['congress-1', 'fed-1'] }]);
    pushSel([{ id: 'fed-1', organizationType: 'federation' }]);
    // getFederationAncestorId(sourceOrganizationId='org-a')
    pushSel([{ id: 'org-a', organizationType: 'union', hierarchyPath: ['congress-1', 'fed-1'] }]);
    pushSel([{ id: 'fed-1', organizationType: 'federation' }]);

    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'federation',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(true);
  });

  it('federation sharingLevel denies orgs in a DIFFERENT federation', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    pushSel([{ id: 'org-b', organizationType: 'union', hierarchyPath: ['congress-1', 'fed-2'] }]);
    pushSel([{ id: 'fed-2', organizationType: 'federation' }]);
    pushSel([{ id: 'org-a', organizationType: 'union', hierarchyPath: ['congress-1', 'fed-1'] }]);
    pushSel([{ id: 'fed-1', organizationType: 'federation' }]);

    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'federation',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(false);
  });

  it('congress sharingLevel requires BOTH orgs to be CLC-affiliated with an active membership', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    // isOrgCongressEligible('org-b'): clcAffiliated org lookup, then active-membership lookup
    pushSel([{ clcAffiliated: true }]);
    pushSel([{ id: 'membership-b' }]);
    // isOrgCongressEligible('org-a')
    pushSel([{ clcAffiliated: true }]);
    pushSel([{ id: 'membership-a' }]);

    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'congress',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(true);
  });

  it('congress sharingLevel denies when the owner org has no active congress membership', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    pushSel([{ clcAffiliated: true }]);
    pushSel([{ id: 'membership-b' }]);
    pushSel([{ clcAffiliated: true }]);
    pushSel([]); // owner has no active membership row

    const result = await canReadSharedClause('org-b', {
      sourceOrganizationId: 'org-a',
      sharingLevel: 'congress',
      sharedWithOrgIds: null,
    });
    expect(result).toBe(false);
  });
});


