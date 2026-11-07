import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

// DEF-0B6-EMP-REGISTRY-ARCHIVE-IGNORES-DEPENDENTS: the governed employer archive.
const h = vi.hoisted(() => ({
  selects: [] as unknown[][],
  calls: [] as Array<Record<string, unknown>>,
  audit: vi.fn(async () => undefined),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));

import { archiveEmployerGoverned } from '../employer-archive';
import { assertEmployerStatusWritable, EMPLOYER_WRITABLE_FIELDS } from '../employer-writable-fields';
import { employers } from '@/db/schema/union-structure-schema';

const chain = (take: () => unknown, rec: (prop: string, args: unknown[]) => void) => {
  const c: Record<string, unknown> = new Proxy({}, {
    get: (_t, prop: string) => prop === 'then'
      ? (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(take()).then(res, rej)
      : (...args: unknown[]) => { rec(prop, args); return c; },
  });
  return c;
};
const tx = {
  select: () => { const r: Record<string, unknown> = { op: 'select' }; h.calls.push(r); return chain(() => h.selects.shift() ?? [], (p, a) => { if (p === 'from') r.table = a[0]; if (p === 'where') r.where = a[0]; if (p === 'for') r.lock = a[0]; }); },
  update: (table: unknown) => { const r: Record<string, unknown> = { op: 'update', table }; h.calls.push(r); return chain(() => [{ id: EMPLOYER, status: 'archived', ...(r.set as object) }], (p, a) => { if (p === 'set') r.set = a[0]; }); },
};

const ORG = '11111111-1111-4111-8111-111111111111';
const EMPLOYER = '22222222-2222-4222-8222-222222222222';
const params = { organizationId: ORG, userId: 'admin-1', employerId: EMPLOYER };
const none = () => [[{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }]];
const archive = () => archiveEmployerGoverned(tx as never, params);

describe('governed employer archive', () => {
  beforeEach(() => { h.selects = []; h.calls = []; h.audit.mockClear(); });

  it('locks the employer in the caller organization, stamps archivedAt and updatedBy, and audits in the same transaction', async () => {
    h.selects = [[{ id: EMPLOYER, status: 'active' }], ...none()];
    const row = await archive();
    const lookup = h.calls[0];
    expect(lookup.table).toBe(employers);
    expect(lookup.lock).toBe('update');
    expect(new PgDialect().sqlToQuery(lookup.where as SQL).params).toEqual(expect.arrayContaining([ORG, EMPLOYER]));
    const update = h.calls.find((c) => c.op === 'update')!;
    expect(update.set).toMatchObject({ status: 'archived', updatedBy: 'admin-1' });
    expect((update.set as { archivedAt: unknown }).archivedAt).toBeInstanceOf(Date);
    expect(row.archivedAt).toBeInstanceOf(Date);
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'employer.archive', resourceId: EMPLOYER, organizationId: ORG, userId: 'admin-1' }));
    // every dependent count is scoped to the caller's organization
    for (const count of h.calls.slice(1, 6)) expect(new PgDialect().sqlToQuery(count.where as SQL).params).toEqual(expect.arrayContaining([ORG, EMPLOYER]));
  });

  it.each([
    ['an open timesheet batch', 0, 'openTimesheetBatches'],
    ['an active contact', 1, 'activeContacts'],
    ['a draft communication', 2, 'draftCommunications'],
    ['a live bargaining unit', 3, 'liveBargainingUnits'],
    ['an open worksite', 4, 'openWorksites'],
  ])('refuses with 409 while the employer has %s, writing and auditing nothing', async (_label, index, key) => {
    const counts = none();
    counts[index] = [{ n: 2 }];
    h.selects = [[{ id: EMPLOYER, status: 'active' }], ...counts];
    await expect(archive()).rejects.toMatchObject({ code: 'CONFLICT', details: { dependents: expect.objectContaining({ [key]: 2 }) } });
    expect(h.calls.some((c) => c.op === 'update')).toBe(false);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('answers 404 for an employer of another organization, and 409 for one already archived', async () => {
    h.selects = [[]];
    await expect(archive()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    h.selects = [[{ id: EMPLOYER, status: 'archived' }]];
    await expect(archive()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.calls.some((c) => c.op === 'update')).toBe(false);
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe('employer body fields', () => {
  it('refuses archiving by status edit and restoring an archived employer by status edit', () => {
    expect(() => assertEmployerStatusWritable({ status: 'archived' }, 'active')).toThrow(/archive action/);
    expect(() => assertEmployerStatusWritable({ status: 'archived' }, undefined)).toThrow(/archive action/);
    expect(() => assertEmployerStatusWritable({ status: 'active' }, 'archived')).toThrow(/not restored/);
    expect(() => assertEmployerStatusWritable({ status: 'dispute' }, 'active')).not.toThrow();
    expect(() => assertEmployerStatusWritable({ name: 'x' }, 'archived')).not.toThrow();
  });

  it('never lets the body set the archive stamp, the organization or the attribution', () => {
    for (const field of ['archivedAt', 'organizationId', 'createdBy', 'updatedBy', 'id', 'customFields']) expect(EMPLOYER_WRITABLE_FIELDS).not.toContain(field);
  });
});
