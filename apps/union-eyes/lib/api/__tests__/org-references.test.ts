import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ rows: [] as unknown[], where: vi.fn() }));

vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { code: 'FORBIDDEN' }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { code: 'VALIDATION_ERROR' }),
    notFound: (what: string) => Object.assign(new Error(what), { code: 'NOT_FOUND' }),
  },
}));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: (clause: unknown) => { m.where(clause); return { limit: async () => m.rows }; } }) }) },
}));

const ID = '11111111-1111-4111-8111-111111111111';
const table = { id: 'id', organizationId: 'organization_id' } as never;

describe('assertOrganizationOwns', () => {
  beforeEach(() => { vi.clearAllMocks(); m.rows = [{ id: ID }]; });

  // DEF-0B12-CRUD-UNIT-AND-WORKSITE-FOREIGN-KEYS-ARE-TAKEN-FROM-THE-BODY-WITHOUT-AN-ORGANIZATION-CHECK
  it('reads nothing when no reference is present', async () => {
    const { assertOrganizationOwns } = await import('../org-references');
    await assertOrganizationOwns([{ field: 'employerId', value: undefined, table }, { field: 'worksiteId', value: null, table }], 'org-1');
    expect(m.where).not.toHaveBeenCalled();
  });

  it('accepts a row of the organization and reports another organization\'s row as not found', async () => {
    const { assertOrganizationOwns } = await import('../org-references');
    await expect(assertOrganizationOwns([{ field: 'employerId', value: ID, table }], 'org-1')).resolves.toBeUndefined();
    m.rows = [];
    await expect(assertOrganizationOwns([{ field: 'employerId', value: ID, table }], 'org-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a malformed id as a 400 and a present reference with no organization as a 403, reading nothing', async () => {
    const { assertOrganizationOwns } = await import('../org-references');
    await expect(assertOrganizationOwns([{ field: 'employerId', value: 'x', table }], 'org-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertOrganizationOwns([{ field: 'employerId', value: 5, table }], 'org-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertOrganizationOwns([{ field: 'employerId', value: ID, table }], null)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.where).not.toHaveBeenCalled();
  });
});
