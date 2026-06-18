/**
 * Union Structure Queries — Unit Tests
 *
 * withRLSContext invokes the callback with a fake drizzle-style tx whose
 * builder chains (including .$dynamic()) resolve from a controllable queue.
 * Errors in the queue reject so catch branches are exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    '$dynamic',
  ]) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => {
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

import * as q from '../union-structure-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// EMPLOYERS
// ---------------------------------------------------------------------------
describe('union-structure-queries — employers', () => {
  it('createEmployer returns the created row', async () => {
    push([{ id: 'e1', name: 'Acme' }]);
    expect(await q.createEmployer({ name: 'Acme' } as never)).toEqual({ id: 'e1', name: 'Acme' });
  });
  it('createEmployer rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createEmployer({} as never)).rejects.toThrow('Failed to create employer');
  });
  it('createEmployer uses an injected tx', async () => {
    push([{ id: 'e2', name: 'Beta' }]);
    expect(await q.createEmployer({ name: 'Beta' } as never, makeTx() as never)).toEqual({
      id: 'e2',
      name: 'Beta',
    });
  });

  it('getEmployerById returns row or null', async () => {
    push([{ id: 'e1' }]);
    expect(await q.getEmployerById('e1')).toEqual({ id: 'e1' });
    push([]);
    expect(await q.getEmployerById('missing')).toBeNull();
  });
  it('getEmployerById rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getEmployerById('e1')).rejects.toThrow('Failed to fetch employer');
  });

  it('listEmployersByOrganization with all options', async () => {
    push([{ id: 'e1' }]);
    const r = await q.listEmployersByOrganization('org', {
      status: 'active',
      search: 'ac',
      limit: 10,
      offset: 5,
    });
    expect(r).toHaveLength(1);
  });
  it('listEmployersByOrganization with no options', async () => {
    push([{ id: 'e1' }, { id: 'e2' }]);
    expect(await q.listEmployersByOrganization('org')).toHaveLength(2);
  });
  it('listEmployersByOrganization rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.listEmployersByOrganization('org')).rejects.toThrow('Failed to list employers');
  });

  it('updateEmployer returns updated row', async () => {
    push([{ id: 'e1', name: 'New' }]);
    expect(await q.updateEmployer('e1', { name: 'New' } as never)).toEqual({ id: 'e1', name: 'New' });
  });
  it('updateEmployer rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.updateEmployer('e1', {} as never)).rejects.toThrow('Failed to update employer');
  });

  it('archiveEmployer resolves', async () => {
    push([]);
    await expect(q.archiveEmployer('e1')).resolves.toBeUndefined();
  });
  it('archiveEmployer rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.archiveEmployer('e1')).rejects.toThrow('Failed to archive employer');
  });
});

// ---------------------------------------------------------------------------
// WORKSITES
// ---------------------------------------------------------------------------
describe('union-structure-queries — worksites', () => {
  it('createWorksite returns the created row', async () => {
    push([{ id: 'w1', name: 'Site' }]);
    expect(await q.createWorksite({ name: 'Site' } as never)).toEqual({ id: 'w1', name: 'Site' });
  });
  it('createWorksite rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createWorksite({} as never)).rejects.toThrow('Failed to create worksite');
  });

  it('getWorksiteById returns row or null', async () => {
    push([{ id: 'w1' }]);
    expect(await q.getWorksiteById('w1')).toEqual({ id: 'w1' });
    push([]);
    expect(await q.getWorksiteById('missing')).toBeNull();
  });
  it('getWorksiteById rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getWorksiteById('w1')).rejects.toThrow('Failed to fetch worksite');
  });

  it('listWorksitesByEmployer with all options', async () => {
    push([{ id: 'w1' }]);
    const r = await q.listWorksitesByEmployer('e1', {
      status: 'active',
      search: 'site',
      limit: 5,
      offset: 2,
    });
    expect(r).toHaveLength(1);
  });
  it('listWorksitesByEmployer with no options', async () => {
    push([{ id: 'w1' }]);
    expect(await q.listWorksitesByEmployer('e1')).toHaveLength(1);
  });
  it('listWorksitesByEmployer rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.listWorksitesByEmployer('e1')).rejects.toThrow('Failed to list worksites');
  });

  it('updateWorksite returns updated row', async () => {
    push([{ id: 'w1' }]);
    expect(await q.updateWorksite('w1', {} as never)).toEqual({ id: 'w1' });
  });
  it('updateWorksite rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.updateWorksite('w1', {} as never)).rejects.toThrow('Failed to update worksite');
  });

  it('archiveWorksite resolves', async () => {
    push([]);
    await expect(q.archiveWorksite('w1')).resolves.toBeUndefined();
  });
  it('archiveWorksite rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.archiveWorksite('w1')).rejects.toThrow('Failed to archive worksite');
  });
});

// ---------------------------------------------------------------------------
// BARGAINING UNITS
// ---------------------------------------------------------------------------
describe('union-structure-queries — bargaining units', () => {
  it('createBargainingUnit returns the created row', async () => {
    push([{ id: 'b1', name: 'Unit' }]);
    expect(await q.createBargainingUnit({ name: 'Unit' } as never)).toEqual({ id: 'b1', name: 'Unit' });
  });
  it('createBargainingUnit rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createBargainingUnit({} as never)).rejects.toThrow('Failed to create bargaining unit');
  });

  it('getBargainingUnitById returns row or null', async () => {
    push([{ id: 'b1' }]);
    expect(await q.getBargainingUnitById('b1')).toEqual({ id: 'b1' });
    push([]);
    expect(await q.getBargainingUnitById('missing')).toBeNull();
  });
  it('getBargainingUnitById rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getBargainingUnitById('b1')).rejects.toThrow('Failed to fetch bargaining unit');
  });

  it('listBargainingUnitsByOrganization with all options', async () => {
    push([{ id: 'b1' }]);
    const r = await q.listBargainingUnitsByOrganization('org', {
      status: 'active',
      search: 'u',
      limit: 5,
      offset: 1,
    });
    expect(r).toHaveLength(1);
  });
  it('listBargainingUnitsByOrganization with no options', async () => {
    push([{ id: 'b1' }]);
    expect(await q.listBargainingUnitsByOrganization('org')).toHaveLength(1);
  });
  it('listBargainingUnitsByOrganization rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.listBargainingUnitsByOrganization('org')).rejects.toThrow(
      'Failed to list bargaining units',
    );
  });

  it('getUnitsWithExpiringContracts returns rows', async () => {
    push([{ id: 'b1' }]);
    expect(await q.getUnitsWithExpiringContracts('org', 30)).toHaveLength(1);
  });
  it('getUnitsWithExpiringContracts uses default daysAhead', async () => {
    push([{ id: 'b1' }]);
    expect(await q.getUnitsWithExpiringContracts('org')).toHaveLength(1);
  });
  it('getUnitsWithExpiringContracts rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getUnitsWithExpiringContracts('org')).rejects.toThrow(
      'Failed to fetch units with expiring contracts',
    );
  });

  it('updateBargainingUnit returns updated row', async () => {
    push([{ id: 'b1' }]);
    expect(await q.updateBargainingUnit('b1', {} as never)).toEqual({ id: 'b1' });
  });
  it('updateBargainingUnit rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.updateBargainingUnit('b1', {} as never)).rejects.toThrow(
      'Failed to update bargaining unit',
    );
  });

  it('archiveBargainingUnit resolves', async () => {
    push([]);
    await expect(q.archiveBargainingUnit('b1')).resolves.toBeUndefined();
  });
  it('archiveBargainingUnit rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.archiveBargainingUnit('b1')).rejects.toThrow('Failed to archive bargaining unit');
  });
});

// ---------------------------------------------------------------------------
// COMMITTEES
// ---------------------------------------------------------------------------
describe('union-structure-queries — committees', () => {
  it('createCommittee returns the created row', async () => {
    push([{ id: 'c1', name: 'Safety' }]);
    expect(await q.createCommittee({ name: 'Safety' } as never)).toEqual({ id: 'c1', name: 'Safety' });
  });
  it('createCommittee rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createCommittee({} as never)).rejects.toThrow('Failed to create committee');
  });

  it('getCommitteeById returns row or null', async () => {
    push([{ id: 'c1' }]);
    expect(await q.getCommitteeById('c1')).toEqual({ id: 'c1' });
    push([]);
    expect(await q.getCommitteeById('missing')).toBeNull();
  });
  it('getCommitteeById rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getCommitteeById('c1')).rejects.toThrow('Failed to fetch committee');
  });

  it('listCommitteesByOrganization with all options', async () => {
    push([{ id: 'c1' }]);
    const r = await q.listCommitteesByOrganization('org', {
      committeeType: 'safety',
      status: 'active',
      search: 's',
      limit: 5,
      offset: 1,
    } as never);
    expect(r).toHaveLength(1);
  });
  it('listCommitteesByOrganization with no options', async () => {
    push([{ id: 'c1' }]);
    expect(await q.listCommitteesByOrganization('org')).toHaveLength(1);
  });
  it('listCommitteesByOrganization rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.listCommitteesByOrganization('org')).rejects.toThrow('Failed to list committees');
  });

  it('updateCommittee returns updated row', async () => {
    push([{ id: 'c1' }]);
    expect(await q.updateCommittee('c1', {} as never)).toEqual({ id: 'c1' });
  });
  it('updateCommittee rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.updateCommittee('c1', {} as never)).rejects.toThrow('Failed to update committee');
  });

  it('archiveCommittee resolves', async () => {
    push([]);
    await expect(q.archiveCommittee('c1')).resolves.toBeUndefined();
  });
  it('archiveCommittee rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.archiveCommittee('c1')).rejects.toThrow('Failed to archive committee');
  });
});

// ---------------------------------------------------------------------------
// COMMITTEE MEMBERSHIPS
// ---------------------------------------------------------------------------
describe('union-structure-queries — committee memberships', () => {
  it('createCommitteeMembership inserts and bumps member count', async () => {
    push([{ id: 'm1', committeeId: 'c1', memberId: 'p1' }], []);
    expect(await q.createCommitteeMembership({ committeeId: 'c1', memberId: 'p1' } as never)).toEqual({
      id: 'm1',
      committeeId: 'c1',
      memberId: 'p1',
    });
  });
  it('createCommitteeMembership rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createCommitteeMembership({} as never)).rejects.toThrow(
      'Failed to create committee membership',
    );
  });

  it('getMemberCommitteeMemberships with active filter', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getMemberCommitteeMemberships('p1', { active: true })).toHaveLength(1);
  });
  it('getMemberCommitteeMemberships without options', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getMemberCommitteeMemberships('p1')).toHaveLength(1);
  });
  it('getMemberCommitteeMemberships rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getMemberCommitteeMemberships('p1')).rejects.toThrow(
      'Failed to fetch committee memberships',
    );
  });

  it('getCommitteeMembers with active filter', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getCommitteeMembers('c1', { active: true })).toHaveLength(1);
  });
  it('getCommitteeMembers without options', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getCommitteeMembers('c1')).toHaveLength(1);
  });
  it('getCommitteeMembers rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getCommitteeMembers('c1')).rejects.toThrow('Failed to fetch committee members');
  });

  it('endCommitteeMembership updates and decrements count', async () => {
    push([{ id: 'm1', committeeId: 'c1' }], []);
    expect(await q.endCommitteeMembership('m1', '2025-01-01')).toEqual({
      id: 'm1',
      committeeId: 'c1',
    });
  });
  it('endCommitteeMembership rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.endCommitteeMembership('m1', '2025-01-01')).rejects.toThrow(
      'Failed to end committee membership',
    );
  });
});

// ---------------------------------------------------------------------------
// STEWARD ASSIGNMENTS
// ---------------------------------------------------------------------------
describe('union-structure-queries — steward assignments', () => {
  it('createStewardAssignment returns the created row', async () => {
    push([{ id: 's1', stewardId: 'p1', unitId: 'b1' }]);
    expect(await q.createStewardAssignment({ stewardId: 'p1', unitId: 'b1' } as never)).toEqual({
      id: 's1',
      stewardId: 'p1',
      unitId: 'b1',
    });
  });
  it('createStewardAssignment rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createStewardAssignment({} as never)).rejects.toThrow(
      'Failed to create steward assignment',
    );
  });

  it('getMemberStewardAssignments with active filter', async () => {
    push([{ id: 's1' }]);
    expect(await q.getMemberStewardAssignments('p1', { active: true })).toHaveLength(1);
  });
  it('getMemberStewardAssignments without options', async () => {
    push([{ id: 's1' }]);
    expect(await q.getMemberStewardAssignments('p1')).toHaveLength(1);
  });
  it('getMemberStewardAssignments rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getMemberStewardAssignments('p1')).rejects.toThrow(
      'Failed to fetch steward assignments',
    );
  });

  it('getUnitStewards with all filters', async () => {
    push([{ id: 's1' }]);
    expect(await q.getUnitStewards('b1', { active: true, stewardType: 'chief' })).toHaveLength(1);
  });
  it('getUnitStewards without options', async () => {
    push([{ id: 's1' }]);
    expect(await q.getUnitStewards('b1')).toHaveLength(1);
  });
  it('getUnitStewards rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getUnitStewards('b1')).rejects.toThrow('Failed to fetch unit stewards');
  });

  it('endStewardAssignment returns updated row', async () => {
    push([{ id: 's1' }]);
    expect(await q.endStewardAssignment('s1', '2025-01-01')).toEqual({ id: 's1' });
  });
  it('endStewardAssignment rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.endStewardAssignment('s1', '2025-01-01')).rejects.toThrow(
      'Failed to end steward assignment',
    );
  });
});

// ---------------------------------------------------------------------------
// ROLE TENURE HISTORY
// ---------------------------------------------------------------------------
describe('union-structure-queries — role tenure history', () => {
  it('createRoleTenureHistory ends existing current role then inserts', async () => {
    push([], [{ id: 't1', memberId: 'p1', roleTitle: 'Pres' }]);
    expect(
      await q.createRoleTenureHistory({
        memberId: 'p1',
        roleType: 'officer',
        isCurrentRole: true,
      } as never),
    ).toEqual({ id: 't1', memberId: 'p1', roleTitle: 'Pres' });
  });
  it('createRoleTenureHistory without isCurrentRole skips the end-update', async () => {
    push([{ id: 't2', memberId: 'p1' }]);
    expect(
      await q.createRoleTenureHistory({ memberId: 'p1', roleType: 'officer' } as never),
    ).toEqual({ id: 't2', memberId: 'p1' });
  });
  it('createRoleTenureHistory rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createRoleTenureHistory({ memberId: 'p1' } as never)).rejects.toThrow(
      'Failed to create role tenure history',
    );
  });

  it('getMemberRoleHistory with all options', async () => {
    push([{ id: 't1' }]);
    expect(await q.getMemberRoleHistory('p1', { currentOnly: true, roleType: 'officer' })).toHaveLength(
      1,
    );
  });
  it('getMemberRoleHistory without options', async () => {
    push([{ id: 't1' }]);
    expect(await q.getMemberRoleHistory('p1')).toHaveLength(1);
  });
  it('getMemberRoleHistory rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getMemberRoleHistory('p1')).rejects.toThrow('Failed to fetch role history');
  });

  it('endRoleTenure returns updated row', async () => {
    push([{ id: 't1' }]);
    expect(await q.endRoleTenure('t1', '2025-01-01', 'resigned', 'admin')).toEqual({ id: 't1' });
  });
  it('endRoleTenure rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.endRoleTenure('t1', '2025-01-01', 'resigned')).rejects.toThrow(
      'Failed to end role tenure',
    );
  });

  it('getOrganizationRoleHistory with all options', async () => {
    push([{ id: 't1' }]);
    const r = await q.getOrganizationRoleHistory('org', {
      roleType: 'officer',
      currentOnly: true,
      limit: 10,
      offset: 5,
    });
    expect(r).toHaveLength(1);
  });
  it('getOrganizationRoleHistory without options', async () => {
    push([{ id: 't1' }]);
    expect(await q.getOrganizationRoleHistory('org')).toHaveLength(1);
  });
  it('getOrganizationRoleHistory rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getOrganizationRoleHistory('org')).rejects.toThrow(
      'Failed to fetch organization role history',
    );
  });
});
