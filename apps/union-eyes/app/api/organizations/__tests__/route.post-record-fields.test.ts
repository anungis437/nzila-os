import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B10-OPL-03: the creation route listed no description, province_territory, charter_number or affiliation_date among the values it
// inserted, so those fields were dropped whatever the body stated while the response was 201.
const m = vi.hoisted(() => ({
  values: vi.fn(),
  returning: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'admin-1' }),
  requireSystemAdmin: vi.fn().mockResolvedValue(undefined),
  ROLE_HIERARCHY: { member: 1, steward: 2, officer: 3, admin: 4, system_admin: 5 },
  isPlatformAdminUser: vi.fn().mockResolvedValue(true),
}));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: vi.fn().mockResolvedValue({ userId: 'admin-1' }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => unknown)({}),
  withSystemContext: async (fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({ values: (v: unknown) => { m.values(v); return { returning: m.returning }; } }),
  },
}));
vi.mock('@/db/schema', () => ({ organizations: {} }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/utils/hierarchy-validation', () => ({ MAX_HIERARCHY_DEPTH: 10 }));

async function post(body: Record<string, unknown>) {
  const { POST } = await import('../route');
  return POST(new Request('http://localhost/api/organizations', { method: 'POST', body: JSON.stringify(body) }) as never);
}

describe('POST /api/organizations record fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.returning.mockResolvedValue([{ id: 'new-org' }]);
  });

  it('stores the description, province, charter number and affiliation date it was given', async () => {
    const res = await post({
      name: 'Local 9', slug: 'local-9', type: 'local', description: 'A local', province_territory: 'ON', charter_number: 'C-9', affiliation_date: '2020-05-01',
    });
    expect(res.status).toBe(201);
    expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ description: 'A local', provinceTerritory: 'ON', charterNumber: 'C-9', affiliationDate: '2020-05-01' }));
  });

  it('stores null for a field that is not supplied', async () => {
    await post({ name: 'Local 9', slug: 'local-9', type: 'local' });
    expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ description: null, provinceTerritory: null, charterNumber: null, affiliationDate: null }));
  });

  it('refuses a field of the wrong shape or an impossible date instead of dropping it, and inserts nothing', async () => {
    for (const body of [{ charter_number: 12 }, { description: { x: 1 } }, { affiliation_date: '2020-13-45' }, { affiliation_date: 'May 1' }]) {
      const res = await post({ name: 'Local 9', slug: 'local-9', type: 'local', ...body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(m.values).not.toHaveBeenCalled();
  });
});
