import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ queue: [] as unknown[], audit: vi.fn(), where: vi.fn(), compare: vi.fn() }));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'limit', 'insert', 'values', 'set', 'update', 'delete', 'returning', 'orderBy']) c[m] = () => c;
  c.where = (...args: unknown[]) => {
    h.where(...args);
    return c;
  };
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  return c;
}
const tx = chain();

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));
vi.mock('@/lib/services/clause-service', () => ({ compareClauses: h.compare }));
vi.mock('@/db/schema', () => ({
  cbaClause: new Proxy({}, { get: (_t, p) => `clauses.${String(p)}` }),
  clauseComparisons: new Proxy({}, { get: (_t, p) => `comparisons.${String(p)}` }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
  asc: (c: unknown) => c,
  inArray: (c: unknown, v: unknown) => ({ inArray: [c, v] }),
  sql: Object.assign((..._a: unknown[]) => 'sql', {}),
}));

import {
  compareClausesInOrganization,
  deleteClauseAudited,
  getClauseForOrganization,
  saveClauseComparisonAudited,
  updateClauseAudited,
} from '../clause-audited-service';

const scope = { organizationId: 'org-1', userId: 'user-1' };
const predicate = (call = 0) => JSON.stringify(h.where.mock.calls[call]);

beforeEach(() => {
  h.queue.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.where.mockReset();
  h.compare.mockReset();
});

describe('clause-audited-service', () => {
  it('reads a clause by id and organization; another organization\'s clause is null', async () => {
    h.queue.push([]);
    expect(await getClauseForOrganization('org-1', 'k1')).toBeNull();
    expect(predicate()).toContain('"clauses.organizationId","org-1"');
  });

  it('updates a clause of the organization and audits on the same transaction', async () => {
    h.queue.push([{ id: 'k1', cbaId: 'c1' }]);
    expect(await updateClauseAudited(scope, 'k1', { title: 'T' })).toMatchObject({ id: 'k1' });
    expect(predicate()).toContain('"clauses.organizationId","org-1"');
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'clause.update', resourceId: 'k1' }),
    );
  });

  it('update matching nothing (missing or another organization) is null with no audit', async () => {
    h.queue.push([]);
    expect(await updateClauseAudited(scope, 'k1', { title: 'T' })).toBeNull();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('a failing audit fails the update', async () => {
    h.queue.push([{ id: 'k1', cbaId: 'c1' }]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(updateClauseAudited(scope, 'k1', { title: 'T' })).rejects.toThrow('audit down');
  });

  it('deletes only a clause of the organization and audits the deletion', async () => {
    h.queue.push([{ id: 'k1', cbaId: 'c1', clauseNumber: '1.01' }]);
    expect(await deleteClauseAudited(scope, 'k1')).toBe(true);
    expect(predicate()).toContain('"clauses.organizationId","org-1"');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'clause.delete', resourceId: 'k1' }));
  });

  it('deleting nothing is false with no audit', async () => {
    h.queue.push([]);
    expect(await deleteClauseAudited(scope, 'k1')).toBe(false);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('a comparison naming a clause outside the organization is refused before any analysis', async () => {
    h.queue.push([{ id: 'k1' }]);
    expect(await compareClausesInOrganization('org-1', { clauseIds: ['k1', 'k2'], analysisType: 'all' })).toBeNull();
    expect(h.compare).not.toHaveBeenCalled();
  });

  it('a comparison of the organization\'s own clauses is analysed within the organization', async () => {
    h.queue.push([{ id: 'k1' }, { id: 'k2' }]);
    h.compare.mockResolvedValue({ clauses: [] });
    await compareClausesInOrganization('org-1', { clauseIds: ['k1', 'k2', 'k2'], analysisType: 'all' });
    expect(h.compare).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', clauseIds: ['k1', 'k2'] }));
  });

  it('saves a comparison for the caller\'s organization and audits it', async () => {
    h.queue.push([{ id: 'cmp1' }]);
    await saveClauseComparisonAudited(scope, { comparisonName: 'N', clauseType: 'wages', clauseIds: ['k1', 'k2'], analysisResults: undefined });
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'clause.comparison.save', resourceId: 'cmp1' }),
    );
  });
});
