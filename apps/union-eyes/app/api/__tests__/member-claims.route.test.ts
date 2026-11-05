import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const m = vi.hoisted(() => ({
  membershipRows: [] as unknown[],
  claimRows: [] as unknown[],
  membershipWhere: vi.fn(),
  claimsShape: vi.fn(),
  claimsWhere: vi.fn(),
  claimsOrderBy: vi.fn(),
  getCaseActor: vi.fn(),
  // Tables answer any column as its own name, and carry the table name so the fake db can tell the two queries apart.
  table: (name: string) =>
    new Proxy({ __table: name } as Record<string, unknown>, { get: (target, key) => (key in target ? target[key as string] : `${name}.${String(key)}`) }),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
}));

vi.mock('@/db/schema', () => ({ claims: m.table('claims') }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: m.table('organization_members') }));
vi.mock('@/db/db', () => ({
  db: {
    select: (shape: Record<string, unknown>) => ({
      from: (from: { __table: string }) => ({
        where: (condition: unknown) => {
          if (from.__table === 'organization_members') {
            m.membershipWhere(condition);
            return { limit: async () => m.membershipRows };
          }
          m.claimsShape(shape);
          m.claimsWhere(condition);
          return { orderBy: async (...keys: unknown[]) => { m.claimsOrderBy(...keys); return m.claimRows; } };
        },
      }),
    }),
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...parts: unknown[]) => ({ and: parts }),
  or: (...parts: unknown[]) => ({ or: parts }),
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  desc: (a: unknown) => ({ desc: a }),
  isNull: (a: unknown) => ({ isNull: a }),
}));
vi.mock('@/lib/cases/case-authorization', () => ({
  getCaseActor: m.getCaseActor,
  caseReadScope: (actor: unknown) => ({ caseReadScope: actor }),
}));

import { GET } from '../members/[id]/claims/route';

const MEMBERSHIP_ID = '3f2b1c9e-7d4a-4e1b-9c55-0a6b8d2f1e33';
const actor = { userId: 'user_caller', organizationId: 'org-1', role: 'steward' };

const call = (id: string) => (GET as unknown as (context: { params: { id: string } }) => Promise<unknown>)({ params: { id } });

beforeEach(() => {
  vi.clearAllMocks();
  m.membershipRows = [{ userId: 'user_member' }];
  m.claimRows = [];
  m.getCaseActor.mockResolvedValue(actor);
});

describe('GET /api/members/[id]/claims', () => {
  it('answers 404 for a reference that cannot be a membership, without resolving the caller or querying', async () => {
    await expect(call('not-a-uuid')).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Member not found' });

    expect(m.getCaseActor).not.toHaveBeenCalled();
    expect(m.membershipWhere).not.toHaveBeenCalled();
    expect(m.claimsWhere).not.toHaveBeenCalled();
  });

  it('answers 404 when the caller\'s organization has no such live membership, and lists no claims', async () => {
    m.membershipRows = [];

    await expect(call(MEMBERSHIP_ID)).rejects.toBeInstanceOf(ApiError);
    await expect(call(MEMBERSHIP_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // The membership is looked up in the organization of the caller, and a removed membership does not count.
    expect(m.membershipWhere.mock.calls[0][0]).toEqual({
      and: [
        { eq: ['organization_members.id', MEMBERSHIP_ID] },
        { eq: ['organization_members.organizationId', 'org-1'] },
        { isNull: 'organization_members.deletedAt' },
      ],
    });
    expect(m.claimsWhere).not.toHaveBeenCalled();
  });

  it('lists the claims of the member\'s user id, which is not the membership id, within what the case kernel lets the caller read', async () => {
    const rows = [{ id: 'c-2', claimId: 'cid-2', claimNumber: 'CLM-2', claimType: 'wage_dispute', status: 'under_review', priority: 'high', createdAt: '2026-03-02T00:00:00.000Z', updatedAt: '2026-03-03T00:00:00.000Z' }];
    m.claimRows = rows;

    await expect(call(MEMBERSHIP_ID)).resolves.toBe(rows);

    expect(m.claimsWhere.mock.calls[0][0]).toEqual({
      and: [
        { caseReadScope: actor },
        { or: [{ eq: ['claims.memberId', 'user_member'] }, { eq: ['claims.assignedTo', 'user_member'] }] },
      ],
    });
    expect(JSON.stringify(m.claimsWhere.mock.calls)).not.toContain(MEMBERSHIP_ID);
  });

  it('sends the list columns only, newest first with a stable tie-break', async () => {
    await call(MEMBERSHIP_ID);

    expect(Object.keys(m.claimsShape.mock.calls[0][0] as Record<string, unknown>)).toEqual([
      'id',
      'claimId',
      'claimNumber',
      'claimType',
      'status',
      'priority',
      'createdAt',
      'updatedAt',
    ]);
    expect(m.claimsOrderBy.mock.calls[0]).toEqual([{ desc: 'claims.createdAt' }, { desc: 'claims.id' }]);
  });

  it('lists nothing for a member the caller may read nothing about: an empty list is the kernel\'s answer, not an error', async () => {
    m.claimRows = [];

    await expect(call(MEMBERSHIP_ID)).resolves.toEqual([]);
  });

  it('passes a refusal of the caller through, before the membership is read', async () => {
    m.getCaseActor.mockRejectedValue(ApiError.forbidden());

    await expect(call(MEMBERSHIP_ID)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(m.membershipWhere).not.toHaveBeenCalled();
    expect(m.claimsWhere).not.toHaveBeenCalled();
  });
});
