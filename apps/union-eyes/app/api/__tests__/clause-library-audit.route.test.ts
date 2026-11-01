import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  audit: vi.fn(),
  denial: vi.fn(),
  where: vi.fn(),
  isOwner: vi.fn(),
  canRead: vi.fn(),
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'leftJoin', 'limit', 'insert', 'values', 'update', 'set', 'delete', 'returning', 'orderBy', 'onConflictDoNothing']) c[m] = () => c;
  c.where = (...a: unknown[]) => {
    h.where(...a);
    return c;
  };
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  return c;
}
const tx = chain();

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
    notFound: (resource: string) => Object.assign(new Error(`${resource} not found`), { status: 404 }),
  },
}));
vi.mock('@/db/db', () => ({ db: chain() }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: new Proxy({}, { get: (_t, p) => `scl.${String(p)}` }),
  clauseLibraryTags: new Proxy({}, { get: (_t, p) => `tag.${String(p)}` }),
  sharedClauseVersions: new Proxy({}, { get: (_t, p) => `ver.${String(p)}` }),
}));
vi.mock('@/db/schema-organizations', () => ({ organizations: new Proxy({}, { get: (_t, p) => `org.${String(p)}` }) }));
vi.mock('@/db/schema', () => ({
  organizations: {},
  congressMemberships: {},
  collectiveAgreements: new Proxy({}, { get: (_t, p) => `cba.${String(p)}` }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  or: (...a: unknown[]) => a,
  inArray: (...a: unknown[]) => a,
  ilike: (...a: unknown[]) => a,
  gte: (...a: unknown[]) => a,
  isNull: (a: unknown) => a,
  sql: Object.assign((..._a: unknown[]) => 'sql', {}),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_s: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
  withSystemContext: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  sourceNamesFor: async () => new Map<string, string>(),
  sharingChangeDenial: h.denial,
  isSharedClauseOwner: h.isOwner,
  canReadSharedClause: h.canRead,
  buildClauseVisibilityCondition: vi.fn(),
}));

const req = (path: string, body: unknown) => ({ url: `http://x${path}`, json: async () => body });
// The route reads the caller's role from the session user (public sharing needs an officer); ids in bodies are guids.
const TAG_A = '11111111-1111-4111-8111-111111111111';
const TAG_B = '22222222-2222-4222-8222-222222222222';
const CBA_X = '33333333-3333-4333-8333-333333333333';
const ctx = (path: string, body: unknown, role = 'officer') => ({ request: req(path, body), organizationId: 'org-1', userId: 'u1', user: { role } });

beforeEach(() => {
  h.queue.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.denial.mockReset().mockResolvedValue(null);
  h.where.mockReset();
  h.isOwner.mockReset().mockReturnValue(true);
  h.canRead.mockReset().mockResolvedValue(true);
});

describe('clause-library/[id]/tags', () => {
  it('POST adds a tag to an owned clause and audits it on the same transaction', async () => {
    const { POST } = await import('../clause-library/[id]/tags/route');
    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-1' }], [{ id: 't1', tagName: 'wages' }]);
    await POST(ctx('/api/clause-library/k1/tags', { tagName: ' wages ' }));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ organizationId: 'org-1', userId: 'u1', action: 'clause_library.tag.add', resourceId: 't1' }));
  });

  it('POST on a clause the caller does not own is 404 with no write or audit', async () => {
    const { POST } = await import('../clause-library/[id]/tags/route');
    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-2' }]);
    h.isOwner.mockReturnValue(false);
    await expect(POST(ctx('/api/clause-library/k1/tags', { tagName: 'x' }))).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('DELETE removing nothing is 404 with no audit; removing a tag is audited', async () => {
    const { DELETE } = await import('../clause-library/[id]/tags/route');
    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-1' }], []);
    await expect(DELETE(ctx('/api/clause-library/k1/tags', { tagId: TAG_B }))).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();

    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-1' }], [{ id: 't1', tagName: 'wages' }]);
    await DELETE(ctx('/api/clause-library/k1/tags', { tagId: TAG_A }));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'clause_library.tag.remove', resourceId: 't1' }));
  });
});

describe('clause-library/[id]/share POST', () => {
  it('refuses a sharing scope the owner has no standing in, before touching the clause', async () => {
    const { POST } = await import('../clause-library/[id]/share/route');
    h.denial.mockResolvedValue({ status: 403, message: 'Congress sharing requires an active congress membership' });
    await expect(POST(ctx('/api/clause-library/k1/share', { sharingLevel: 'congress' }))).rejects.toMatchObject({ status: 403 });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('records the old and new sharing level in the audit on the same transaction', async () => {
    const { POST } = await import('../clause-library/[id]/share/route');
    h.queue.push(
      [{ id: 'k1', sourceOrganizationId: 'org-1', sharingLevel: 'private' }],
      [{ id: 'k1', sharingLevel: 'public', sharedWithOrgIds: null }],
    );
    await POST(ctx('/api/clause-library/k1/share', { sharingLevel: 'public' }));
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'clause_library.sharing.update', details: expect.objectContaining({ fromSharingLevel: 'private', toSharingLevel: 'public' }) }),
    );
  });

  it('constrains the update to the owner organization', async () => {
    const { POST } = await import('../clause-library/[id]/share/route');
    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-1', sharingLevel: 'private' }], [{ id: 'k1', sharingLevel: 'public' }]);
    await POST(ctx('/api/clause-library/k1/share', { sharingLevel: 'public' }));
    expect(JSON.stringify(h.where.mock.calls)).toContain('"scl.sourceOrganizationId","org-1"');
  });
});

describe('clause-library/[id] PATCH and DELETE', () => {
  it('DELETE audits the deletion and a non-owner gets 404', async () => {
    const { DELETE } = await import('../clause-library/[id]/route');
    // The clause read, the final-text version insert, then the delete.
    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-1', clauseNumber: '1', sharingLevel: 'private' }], [], [{ id: 'k1' }]);
    await DELETE(ctx('/api/clause-library/k1', undefined));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'clause_library.delete', resourceId: 'k1' }));

    h.audit.mockClear();
    h.queue.push([{ id: 'k1', sourceOrganizationId: 'org-2' }]);
    h.isOwner.mockReturnValue(false);
    await expect(DELETE(ctx('/api/clause-library/k1', undefined))).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('PATCH validates a sharing change before the update', async () => {
    const { PATCH } = await import('../clause-library/[id]/route');
    h.denial.mockResolvedValue({ status: 400, message: 'sharingLevel must be one of private, federation, congress, public' });
    // The body schema (B45) now refuses an unknown level before the sharing authority is consulted.
    await expect(PATCH(ctx('/api/clause-library/k1', { sharingLevel: 'galaxy' }))).rejects.toThrow(/Invalid clause \(sharingLevel\)/);
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe('clause-library POST', () => {
  const body = { clauseTitle: 'T', clauseText: 'X', clauseType: 'wages' };

  it('creates the clause owned by the caller\'s organization and audits it on the same transaction', async () => {
    const { POST } = await import('../clause-library/route');
    h.queue.push([{ id: 'k1', clauseType: 'wages', sharingLevel: 'private', sourceCbaId: null }]);
    await POST(ctx('/api/clause-library', { ...body, sourceOrganizationId: 'org-evil' }));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ organizationId: 'org-1', userId: 'u1', action: 'clause_library.create', resourceId: 'k1' }));
  });

  it('refuses an agreement of another organization as the source', async () => {
    const { POST } = await import('../clause-library/route');
    h.queue.push([]);
    await expect(POST(ctx('/api/clause-library', { ...body, sourceCbaId: CBA_X }))).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('refuses a sharing scope the organization cannot hold', async () => {
    const { POST } = await import('../clause-library/route');
    h.denial.mockResolvedValue({ status: 403, message: 'Federation sharing requires membership of a federation' });
    await expect(POST(ctx('/api/clause-library', { ...body, sharingLevel: 'federation' }))).rejects.toMatchObject({ status: 403 });
  });
});
