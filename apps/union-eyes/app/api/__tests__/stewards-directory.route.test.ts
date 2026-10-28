import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B11-IDS-STEWARD-ASSIGNMENT-ROWS-READABLE-BY-ANY-MEMBER…: a member read the whole assignment row, including the
// steward's personal phone, notes and grievance link. Members now receive an allow-listed projection of active rows.

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  audit: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  wheres: [] as unknown[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
  z: require('zod').z,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({
        from: () => ({
          where: (w: unknown) => {
            m.wheres.push(w);
            const result = Promise.resolve(m.rows);
            return Object.assign(result, {
              orderBy: () => ({ limit: () => ({ offset: async () => m.rows }) }),
              limit: async () => m.rows,
            });
          },
        }),
      }),
    }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
  asc: (c: unknown) => c,
}));
vi.mock('@/db/schema', () => ({
  stewardAssignments: { organizationId: 'organizationId', status: 'status', id: 'id', createdAt: 'createdAt' },
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';

const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  organizationId: ORG,
  stewardId: 'user-steward',
  stewardType: 'worksite',
  status: 'active',
  department: 'Stores',
  workPhone: '613-555-0100',
  preferredContactMethod: 'email',
  personalPhone: '613-555-0199',
  availabilityNotes: 'after 6pm only',
  notes: 'under review for misconduct',
  grievanceId: '33333333-3333-4333-8333-333333333333',
  createdBy: 'officer-1',
  ...over,
});

const PRIVATE = ['personalPhone', 'availabilityNotes', 'notes', 'grievanceId', 'createdBy', 'organizationId'];

const listReq = () => ({ request: new Request('http://localhost/api/stewards'), organizationId: ORG, userId: 'u1' });

describe('GET /api/stewards (collection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.wheres = [];
    m.rows = [row()];
    m.audit.mockResolvedValue(undefined);
  });

  it('gives a member the work contact and coverage but never the personal phone, notes or grievance link', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await import('../stewards/route');
    const result = (await (GET as any)(listReq())) as { view: string; data: Array<Record<string, unknown>> };
    expect(result.view).toBe('member');
    expect(result.data[0]).toMatchObject({ workPhone: '613-555-0100', department: 'Stores', stewardType: 'worksite' });
    for (const key of PRIVATE) expect(result.data[0]).not.toHaveProperty(key);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('limits a member to active assignments in their own organization', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await import('../stewards/route');
    await (GET as any)(listReq());
    expect(JSON.stringify(m.wheres[0])).toContain('"active"');
    expect(JSON.stringify(m.wheres[0])).toContain(ORG);
  });

  it('gives an officer the full rows and audits the private read', async () => {
    m.hasMinRole.mockResolvedValue(true);
    const { GET } = await import('../stewards/route');
    const result = (await (GET as any)(listReq())) as { view: string; data: Array<Record<string, unknown>> };
    expect(result.view).toBe('officer');
    expect(result.data[0]).toHaveProperty('personalPhone', '613-555-0199');
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'stewards.directory.read_private', organizationId: ORG, userId: 'u1' }));
    expect(JSON.stringify(m.wheres[0])).not.toContain('"active"');
  });

  it('withholds the private rows when the audit cannot be written', async () => {
    m.hasMinRole.mockResolvedValue(true);
    m.audit.mockRejectedValue(new Error('audit down'));
    const { GET } = await import('../stewards/route');
    await expect((GET as any)(listReq())).rejects.toThrow('audit down');
  });

  it('refuses a request with no organization context', async () => {
    const { GET } = await import('../stewards/route');
    await expect((GET as any)({ ...listReq(), organizationId: null })).rejects.toThrow('Organization context required');
  });
});

describe('GET /api/stewards/[id] (item)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.wheres = [];
    m.rows = [row()];
    m.audit.mockResolvedValue(undefined);
  });

  const itemReq = (id: string) => ({ params: { id }, organizationId: ORG, userId: 'u1' });

  it('projects the row for a member', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await import('../stewards/[id]/route');
    const result = (await (GET as any)(itemReq(ID))) as { data: Record<string, unknown> };
    for (const key of PRIVATE) expect(result.data).not.toHaveProperty(key);
    expect(result.data).toHaveProperty('workPhone');
  });

  it('reads a non-active assignment as not found for a member', async () => {
    m.hasMinRole.mockResolvedValue(false);
    m.rows = [row({ status: 'ended' })];
    const { GET } = await import('../stewards/[id]/route');
    await expect((GET as any)(itemReq(ID))).rejects.toThrow('Steward assignment not found');
  });

  it('reads a missing or other-organization assignment as not found', async () => {
    m.hasMinRole.mockResolvedValue(true);
    m.rows = [];
    const { GET } = await import('../stewards/[id]/route');
    await expect((GET as any)(itemReq(ID))).rejects.toThrow('Steward assignment not found');
    expect(JSON.stringify(m.wheres[0])).toContain(ORG);
  });

  it('gives an officer the full row and audits it', async () => {
    m.hasMinRole.mockResolvedValue(true);
    const { GET } = await import('../stewards/[id]/route');
    const result = (await (GET as any)(itemReq(ID))) as { data: Record<string, unknown> };
    expect(result.data).toHaveProperty('notes');
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'stewards.assignment.read_private', resourceId: ID }));
  });

  it('rejects a malformed identifier before reading', async () => {
    m.hasMinRole.mockResolvedValue(true);
    const { GET } = await import('../stewards/[id]/route');
    await expect((GET as any)(itemReq('not-a-uuid'))).rejects.toThrow('id must be a valid identifier');
    expect(m.wheres).toHaveLength(0);
  });
});
