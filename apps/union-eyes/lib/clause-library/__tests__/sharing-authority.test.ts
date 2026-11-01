import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — shared_clause_library OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY, enforced by the database since cache 0048.
// The read rule is ONE database function (public.ue_clause_readable_by) that the tenant policy and these helpers both ask. Its behaviour over a
// real hierarchy, with the real roles, is proven in db/__tests__/clause-library-visibility.postgres.test.ts; this file pins the wiring: what is asked
// of the function, that only a strict true admits, that a malformed id fails closed before any query, and that a stored value can never change the
// statement.

const h = vi.hoisted(() => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const answers: unknown[] = [];
  const db = {
    execute: async (query: { strings?: readonly string[]; values?: unknown[] }) => {
      calls.push({ text: (query.strings ?? []).join('?'), values: query.values ?? [] });
      return answers.length ? answers.shift() : [];
    },
  };
  return { calls, answers, db };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    { raw: vi.fn() },
  ),
}));
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
  beforeEach(() => {
    vi.clearAllMocks();
    h.calls.length = 0;
    h.answers.length = 0;
  });

  it('asks the database function for the owner, the level, the grants and the caller, and nothing else', async () => {
    h.answers.push([{ readable: true }]);
    const { canReadSharedClause } = await import('../sharing-authority');
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: [B, C] })).toBe(true);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].text).toContain('public.ue_clause_readable_by(');
    expect(h.calls[0].values[0]).toBe(A);
    expect(h.calls[0].values[1]).toBe('private');
    expect(h.calls[0].values[3]).toBe(B);
  });

  it('admits only on a strict true: false, null and no row all deny', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    for (const answer of [[{ readable: false }], [{ readable: null }], [{}], [], { rows: [{ readable: false }] }, { rows: [] }, [{ readable: 1 }], [{ readable: 'true' }]]) {
      h.answers.push(answer);
      expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(false);
    }
    h.answers.push({ rows: [{ readable: true }] });
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(true);
  });

  it('fails closed, without a query, for a malformed caller or owner id', async () => {
    const { canReadSharedClause } = await import('../sharing-authority');
    expect(await canReadSharedClause('org-b', { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(false);
    expect(await canReadSharedClause(B, { sourceOrganizationId: "x'; DROP TABLE shared_clause_library; --", sharingLevel: 'public' })).toBe(false);
    expect(await canReadSharedClause('', { sourceOrganizationId: A, sharingLevel: 'public' })).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it('builds the grant list only from well-formed ids, so a stored value can never change the statement', async () => {
    h.answers.push([{ readable: false }]);
    const { canReadSharedClause } = await import('../sharing-authority');
    await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'private', sharedWithOrgIds: ['{', '}', 'x","y', `${C}`, '1; DROP TABLE x', null as unknown as string] });
    expect(h.calls[0].values[2]).toEqual({ op: 'sql', strings: ['', '::uuid[]'], values: [`{${C}}`] });
  });

  it('passes an unknown level through for the function to refuse, and treats a missing grant list as empty', async () => {
    h.answers.push([{ readable: false }], [{ readable: false }]);
    const { canReadSharedClause } = await import('../sharing-authority');
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: 'not-a-real-level', sharedWithOrgIds: null })).toBe(false);
    expect(await canReadSharedClause(B, { sourceOrganizationId: A, sharingLevel: null })).toBe(false);
    expect(h.calls[0].values[1]).toBe('not-a-real-level');
    expect((h.calls[1].values[2] as { values: unknown[] }).values).toEqual(['{}']);
  });
});

describe('the hierarchy helpers and the list predicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.calls.length = 0;
    h.answers.length = 0;
  });

  it('read the nearest federation and the congress standing from the same database, as a string and a strict boolean', async () => {
    const { getFederationAncestorId, isOrgCongressEligible } = await import('../sharing-authority');
    h.answers.push([{ id: A }], [], { rows: [{ id: B }] });
    expect(await getFederationAncestorId(C)).toBe(A);
    expect(await getFederationAncestorId(C)).toBeNull();
    expect(await getFederationAncestorId(C)).toBe(B);
    h.answers.push([{ eligible: true }], [{ eligible: false }], [{ eligible: null }], []);
    expect(await isOrgCongressEligible(A)).toBe(true);
    expect(await isOrgCongressEligible(A)).toBe(false);
    expect(await isOrgCongressEligible(A)).toBe(false);
    expect(await isOrgCongressEligible(A)).toBe(false);
    expect(h.calls[0].text).toContain('public.ue_clause_federation_ancestor(');
    expect(h.calls[3].text).toContain('public.ue_clause_congress_eligible(');
  });

  it('build the list predicate from the same function, and a predicate that matches nothing for a malformed caller', async () => {
    const { buildClauseVisibilityCondition } = await import('../sharing-authority');
    const condition = (await buildClauseVisibilityCondition(B)) as unknown as { strings: string[]; values: unknown[] };
    expect(condition.strings.join('?')).toContain('public.ue_clause_readable_by(');
    expect(condition.values).toEqual(['scl.sourceOrganizationId', 'scl.sharingLevel', 'scl.sharedWithOrgIds', B]);
    const none = (await buildClauseVisibilityCondition("b'; DROP TABLE x; --")) as unknown as { strings: string[] };
    expect(none.strings.join('')).toBe('false');
  });

  it('refuse a sharing level the owner has no standing for, and a malformed grant list, and admit a well-formed change', async () => {
    const { sharingChangeDenial } = await import('../sharing-authority');
    expect(await sharingChangeDenial(A, { sharingLevel: 'galaxy' })).toMatchObject({ status: 400 });
    h.answers.push([]);
    expect(await sharingChangeDenial(A, { sharingLevel: 'federation' })).toMatchObject({ status: 403 });
    h.answers.push([{ eligible: false }]);
    expect(await sharingChangeDenial(A, { sharingLevel: 'congress' })).toMatchObject({ status: 403 });
    expect(await sharingChangeDenial(A, { sharedWithOrgIds: ['not-a-uuid'] })).toMatchObject({ status: 400 });
    expect(await sharingChangeDenial(A, { sharedWithOrgIds: Array.from({ length: 201 }, () => B) })).toMatchObject({ status: 400 });
    expect(await sharingChangeDenial(A, { sharingLevel: 'public', sharedWithOrgIds: [B, C] })).toBeNull();
  });
});
