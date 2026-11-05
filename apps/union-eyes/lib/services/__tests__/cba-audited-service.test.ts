import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ queue: [] as unknown[], audit: vi.fn(), where: vi.fn() }));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'limit', 'insert', 'values', 'set', 'update', 'returning']) c[m] = () => c;
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
vi.mock('@/db/schema', () => ({
  collectiveAgreements: new Proxy({}, { get: (_t, p) => `agreements.${String(p)}` }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
  ne: (c: unknown, v: unknown) => ({ ne: [c, v] }),
  sql: Object.assign((..._a: unknown[]) => 'sql', {}),
}));

import {
  archiveCbaAudited,
  createCbaAudited,
  getCbaForOrganization,
  updateCbaAudited,
} from '../cba-audited-service';

const scope = { organizationId: 'org-1', userId: 'user-1' };
const predicate = (call = 0) => JSON.stringify(h.where.mock.calls[call]);

beforeEach(() => {
  h.queue.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.where.mockReset();
});

describe('cba-audited-service', () => {
  it('createCbaAudited stamps the organization and creator itself, never makes the agreement public, and audits on the same transaction', async () => {
    h.queue.push([{ id: 'c1', cbaNumber: 'N-1', status: 'active' }]);
    const created = await createCbaAudited(scope, { cbaNumber: 'N-1' } as never);
    expect(created.id).toBe('c1');
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'cba.create', resourceId: 'c1' }),
    );
  });

  it('createCbaAudited fails when its audit record cannot be written', async () => {
    h.queue.push([{ id: 'c1' }]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(createCbaAudited(scope, {} as never)).rejects.toThrow('audit down');
  });

  it('updateCbaAudited is not found, with no audit, for an agreement in another organization', async () => {
    h.queue.push([]);
    expect(await updateCbaAudited(scope, 'c1', { title: 'x' })).toEqual({ kind: 'not_found' });
    expect(predicate()).toContain('"agreements.organizationId","org-1"');
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('updateCbaAudited audits an applied update', async () => {
    h.queue.push([{ id: 'c1', title: 'x', status: 'active' }]);
    const result = await updateCbaAudited(scope, 'c1', { title: 'x' });
    expect(result.kind).toBe('updated');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'cba.update', resourceId: 'c1' }));
  });

  it('updateCbaAudited carries the status it read, and reports a concurrent change as a conflict without auditing', async () => {
    h.queue.push([{ status: 'active' }], []);
    expect(await updateCbaAudited(scope, 'c1', { status: 'expired' })).toEqual({ kind: 'conflict' });
    expect(JSON.stringify(h.where.mock.calls[1])).toContain('"agreements.status","active"');
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('updateCbaAudited records the status transition', async () => {
    h.queue.push([{ status: 'active' }], [{ id: 'c1', status: 'expired' }]);
    await updateCbaAudited(scope, 'c1', { status: 'expired' });
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ details: { fields: ['status'], fromStatus: 'active', toStatus: 'expired' } }),
    );
  });

  it('archiveCbaAudited archives only a not-yet-archived agreement of the organization and audits it', async () => {
    h.queue.push([{ id: 'c1' }]);
    expect(await archiveCbaAudited(scope, 'c1')).toBe('archived');
    expect(predicate()).toContain('"agreements.organizationId","org-1"');
    expect(predicate()).toContain('"ne"');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'cba.archive', resourceId: 'c1' }));
  });

  it('archiveCbaAudited distinguishes already archived from not found, auditing neither', async () => {
    h.queue.push([], [{ id: 'c1' }]);
    expect(await archiveCbaAudited(scope, 'c1')).toBe('already_archived');
    h.queue.push([], []);
    expect(await archiveCbaAudited(scope, 'c2')).toBe('not_found');
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('getCbaForOrganization reads by id and organization and returns null for another organization', async () => {
    h.queue.push([]);
    expect(await getCbaForOrganization('org-1', 'c1')).toBeNull();
    expect(predicate()).toContain('"agreements.organizationId","org-1"');
  });
});
