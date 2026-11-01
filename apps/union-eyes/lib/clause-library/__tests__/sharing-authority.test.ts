import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — shared_clause_library OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY. The tenant policy of cache 0011/0012 admits the owner, an organization named in
// the explicit grant list of a private clause, and everyone for a public clause; these helpers state the same rule for the item read and for the list
// predicate. Federation and congress sharing are readable by the owner only (cache 0048 evaluated them with SECURITY DEFINER functions that the catalog
// admission contract refuses, and 0050 retired it). The rule over real rows with the real roles is proven in
// db/__tests__/clause-library-visibility.postgres.test.ts; this file pins the pure rule, the refusal and the name lookup.

const h = vi.hoisted(() => {
  const systemQueries: Array<{ ids: unknown }> = [];
  const namesById = new Map<string, string>();
  const withSystemContext = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      select: () => ({
        from: () => ({
          where: (predicate: { ids: string[] }) => {
            systemQueries.push({ ids: predicate.ids });
            return Promise.resolve(predicate.ids.filter((id) => namesById.has(id)).map((id) => ({ id, name: namesById.get(id) })));
          },
        }),
      }),
    }),
  );
  return { systemQueries, namesById, withSystemContext };
});

vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }), { raw: vi.fn() }),
  inArray: (_column: unknown, ids: string[]) => ({ ids }),
}));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'org.id', name: 'org.name' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: h.withSystemContext }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: {
    id: 'scl.id',
    sourceOrganizationId: 'scl.sourceOrganizationId',
    sharingLevel: 'scl.sharingLevel',
    sharedWithOrgIds: 'scl.sharedWithOrgIds',
  },
}));

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('isSharedClauseOwner', () => {
  it('is true only for the source organization', async () => {
    const { isSharedClauseOwner } = await import('../sharing-authority');
    expect(isSharedClauseOwner('org-a', { sourceOrganizationId: 'org-a' })).toBe(true);
    expect(isSharedClauseOwner('org-b', { sourceOrganizationId: 'org-a' })).toBe(false);
  });
});

describe('canReadSharedClause', () => {
  it('admits the owner at every level, including the federation and congress levels others cannot read', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    for (const sharingLevel of ['private', 'public', 'federation', 'congress', 'not-a-real-level', null]) {
      expect(await canReadSharedClause(A, { sourceOrganizationId: A, sharingLevel })).toBe(true);
    }
  });

  it('admits another organization for a public clause and for a private clause that names it, and nothing else', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(true);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: [C, B] })).toBe(true);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: [C] })).toBe(false);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: null })).toBe(false);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private' })).toBe(false);
  });

  it('fails closed for federation, congress, an unknown level and a missing level when the caller is not the owner', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    for (const sharingLevel of ['federation', 'congress', 'not-a-real-level', null]) {
      expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel, sharedWithOrgIds: [B] })).toBe(false);
    }
  });

  it('compares organization ids without regard to case, and ignores a grant that is not a string', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    expect(await canReadSharedClause(B.toUpperCase(), { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: [B] })).toBe(true);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A.toUpperCase(), sharingLevel: 'public' })).toBe(true);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: [null as unknown as string, 7 as unknown as string] })).toBe(false);
  });

  it('fails closed for a malformed caller or owner id', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    expect(await canReadSharedClause('org-b', { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(false);
    expect(await canReadSharedClause(B, { sourceOrganizationId: "x'; DROP TABLE shared_clause_library; --", sharingLevel: 'public' })).toBe(false);
    expect(await canReadSharedClause('', { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(false);
  });
});

describe('the list predicate', () => {
  it('states the owner, public and explicit-grant rule over the row columns and the caller, with the caller as the only parameter', async () => {
    const { buildClauseVisibilityCondition } = await import('../sharing-authority');
    const condition = (await buildClauseVisibilityCondition(B)) as unknown as { strings: string[]; values: unknown[] };
    const text = condition.strings.join('?');
    expect(text).toContain("= 'public'");
    expect(text).toContain("= 'private'");
    expect(text).toContain('ANY (COALESCE(');
    expect(text).not.toMatch(/ue_clause_|federation|congress/);
    expect(condition.values).toContain(B);
    expect(condition.values).toContain('scl.sourceOrganizationId');
    expect(condition.values).toContain('scl.sharingLevel');
    expect(condition.values).toContain('scl.sharedWithOrgIds');
  });

  it('matches nothing for a malformed caller', async () => {
    const { buildClauseVisibilityCondition } = await import('../sharing-authority');
    const none = (await buildClauseVisibilityCondition("b'; DROP TABLE x; --")) as unknown as { strings: string[] };
    expect(none.strings.join('')).toBe('false');
  });
});

describe('sharingChangeDenial', () => {
  it('refuses an unknown level, the federation and congress levels no other organization can read, and a malformed grant list', async () => {
    const { sharingChangeDenial } = await import('../sharing-authority');
    expect(await sharingChangeDenial(A, { sharingLevel: 'galaxy' })).toMatchObject({ status: 400 });
    expect(await sharingChangeDenial(A, { sharingLevel: 7 })).toMatchObject({ status: 400 });
    expect(await sharingChangeDenial(A, { sharingLevel: 'federation' })).toMatchObject({ status: 403, message: expect.stringContaining('federation') });
    expect(await sharingChangeDenial(A, { sharingLevel: 'congress' })).toMatchObject({ status: 403, message: expect.stringContaining('congress') });
    expect(await sharingChangeDenial(A, { sharedWithOrgIds: ['not-a-uuid'] })).toMatchObject({ status: 400 });
    expect(await sharingChangeDenial(A, { sharedWithOrgIds: Array.from({ length: 201 }, () => B) })).toMatchObject({ status: 400 });
  });

  it('admits a well-formed private or public change, and a change that names no level at all', async () => {
    const { sharingChangeDenial } = await import('../sharing-authority');
    expect(await sharingChangeDenial(A, { sharingLevel: 'public', sharedWithOrgIds: [B, C] })).toBeNull();
    expect(await sharingChangeDenial(A, { sharingLevel: 'private', sharedWithOrgIds: [B] })).toBeNull();
    expect(await sharingChangeDenial(A, { sharedWithOrgIds: null })).toBeNull();
    expect(await sharingChangeDenial(A, {})).toBeNull();
  });
});

describe('sourceNamesFor', () => {
  beforeEach(() => {
    h.systemQueries.length = 0;
    h.namesById.clear();
    h.withSystemContext.mockClear();
  });

  it('names only the sources the projection may disclose, by id, on one system read', async () => {
    h.namesById.set(A, 'Local A');
    h.namesById.set(B, 'Local B');
    h.namesById.set(C, 'Local C');
    const { sourceNamesFor } = await import('../sharing-authority');
    const names = await sourceNamesFor(
      [
        { sourceOrganizationId: A, isAnonymized: false },
        { sourceOrganizationId: B, isAnonymized: true },
        { sourceOrganizationId: C, isAnonymized: null },
        { sourceOrganizationId: A, isAnonymized: false },
      ],
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    expect(h.withSystemContext).toHaveBeenCalledTimes(1);
    expect(h.systemQueries).toEqual([{ ids: [A] }]);
    expect([...names.entries()]).toEqual([[A, 'Local A']]);
  });

  it("names the caller's own organization even when its clause is anonymized, and reads nothing when no source is disclosable", async () => {
    h.namesById.set(A, 'Local A');
    const { sourceNamesFor } = await import('../sharing-authority');
    expect([...(await sourceNamesFor([{ sourceOrganizationId: A, isAnonymized: true }], A)).entries()]).toEqual([[A, 'Local A']]);
    h.withSystemContext.mockClear();
    expect((await sourceNamesFor([{ sourceOrganizationId: B, isAnonymized: true }], A)).size).toBe(0);
    expect((await sourceNamesFor([], A)).size).toBe(0);
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('never looks up an id that is not a well-formed organization id', async () => {
    const { sourceNamesFor } = await import('../sharing-authority');
    const names = await sourceNamesFor([{ sourceOrganizationId: "x'; DROP TABLE organizations; --", isAnonymized: false }], A);
    expect(names.size).toBe(0);
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });
});
