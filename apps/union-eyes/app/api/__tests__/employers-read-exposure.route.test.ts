import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B6-EMP-COMMUNICATION-GRIEVANCE-CORRESPONDENCE-STEWARD-READ, DEF-0B6-EMP-CONTACT-PII-READ-AT-STEWARD-UNAUDITED

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  persistAtomicAudit: vi.fn(),
  kernelCaseAccess: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  limit: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: any) => (request: Request, c: any) => handler(request, c),
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/services/case-access-service', () => ({ kernelCaseAccess: m.kernelCaseAccess }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      select: () => ({
        from: () => ({ where: () => ({ orderBy: () => ({ limit: async (n: number) => { m.limit(n); return m.rows; } }) }) }),
      }),
    }),
}));
vi.mock('@/db/db', () => ({ db: {} }));

const ctx = { organizationId: 'org_1', userId: 'steward_1' };
const get = (path: string) => new Request(`http://localhost/api/employers/communications${path}`);

describe('employer correspondence and contacts are bounded, case-scoped and audited on read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasMinRole.mockResolvedValue(true);
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('withholds correspondence linked to a grievance the steward cannot see, keeps unlinked records and audits the read', async () => {
    m.rows = [
      { id: 'a', grievanceId: null, subject: 'General' },
      { id: 'b', grievanceId: 'g-visible', subject: 'Mine' },
      { id: 'c', grievanceId: 'g-hidden', subject: 'Not mine' },
      { id: 'd', grievanceId: 'g-hidden', subject: 'Not mine either' },
    ];
    m.kernelCaseAccess.mockImplementation(async (_tx: unknown, p: { grievanceId: string }) => ({ canViewCase: p.grievanceId === 'g-visible' }));
    const { GET } = await import('../employers/communications/route');

    const response = await GET(get(''), ctx as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((r: { id: string }) => r.id)).toEqual(['a', 'b']);
    expect(m.kernelCaseAccess).toHaveBeenCalledTimes(2);
    expect(m.limit).toHaveBeenCalledWith(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'employer_communication.list',
      details: { returned: 2, withheldForCaseAuthority: 2, truncated: false },
    }));
    expect(JSON.stringify(body)).not.toContain('Not mine');
  });

  it('refuses a caller below steward before reading anything', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await import('../employers/communications/route');
    expect((await GET(get(''), ctx as never)).status).toBe(403);
    expect(m.limit).not.toHaveBeenCalled();
  });

  it('lists employer contacts with a bound and a read audit that records the count, not the people', async () => {
    m.rows = [{ id: 'c1', name: 'Pat', email: 'pat@example.test' }];
    const { GET } = await import('../employers/communications/contacts/route');

    const response = await GET(new Request('http://localhost/api/employers/communications/contacts?employerId=e1'), ctx as never);

    expect(response.status).toBe(200);
    expect(m.limit).toHaveBeenCalledWith(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'employer_contact.list',
      resourceId: 'e1',
      details: { returned: 1, truncated: false },
    }));
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('pat@example.test');
  });

  it('fails the contact list when the read audit cannot be written', async () => {
    m.rows = [];
    m.persistAtomicAudit.mockRejectedValue(new Error('audit down'));
    const { GET } = await import('../employers/communications/contacts/route');
    expect((await GET(new Request('http://localhost/api/employers/communications/contacts'), ctx as never)).status).toBe(500);
  });
});
