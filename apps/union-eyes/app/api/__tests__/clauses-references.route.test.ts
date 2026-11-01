import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ queue: [] as unknown[][] }));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ GET: vi.fn(), POST: vi.fn() }) }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { code: 'FORBIDDEN' }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { code: 'VALIDATION_ERROR' }),
    notFound: (what: string) => Object.assign(new Error(what), { code: 'NOT_FOUND' }),
  },
}));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => m.queue.shift() ?? [] }) }) }) },
}));
vi.mock('@/db/schema', () => ({
  cbaClause: { id: 'id', cbaId: 'cba_id', organizationId: 'organization_id' },
  collectiveAgreements: { id: 'id', organizationId: 'organization_id' },
}));

const CBA = '11111111-1111-4111-8111-111111111111';
const PARENT = '22222222-2222-4222-8222-222222222222';

describe('clauses collection reference checks', () => {
  beforeEach(() => { m.queue = []; });

  // DEF-0B4-CLAUSES-CREATE-ACCEPTS-ANY-CBA-ID
  it('refuses an agreement id that is not the caller organization\'s, as not found', async () => {
    m.queue.push([]);
    const { verifyClauseReferences } = await import('../clauses/route');
    await expect(verifyClauseReferences({ cbaId: CBA, title: 't' }, 'org-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a missing or malformed agreement id and a missing organization before reading anything', async () => {
    const { verifyClauseReferences } = await import('../clauses/route');
    await expect(verifyClauseReferences({ cbaId: 'x' }, 'org-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(verifyClauseReferences({}, 'org-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(verifyClauseReferences({ cbaId: CBA }, null)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('accepts an agreement of the organization and checks a parent clause against the same agreement', async () => {
    const { verifyClauseReferences } = await import('../clauses/route');
    m.queue.push([{ id: CBA }]);
    await expect(verifyClauseReferences({ cbaId: CBA, title: 't' }, 'org-1')).resolves.toMatchObject({ cbaId: CBA });
    m.queue.push([{ id: CBA }], []);
    await expect(verifyClauseReferences({ cbaId: CBA, parentClauseId: PARENT }, 'org-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    m.queue.push([{ id: CBA }], [{ id: PARENT }]);
    await expect(verifyClauseReferences({ cbaId: CBA, parentClauseId: PARENT }, 'org-1')).resolves.toBeTruthy();
  });
});
