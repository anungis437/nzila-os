import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: {
    badRequest: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 400 })),
    externalService: vi.fn((service: string, msg: string) => Object.assign(new Error(`${service}: ${msg}`), { status: 502 })),
    conflict: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 409 })),
  },
  withRLSContext: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn() },
  getUserList: vi.fn(),
  persistAtomicAudit: vi.fn(),
  insertShouldFail: false,
  raceOnInsert: false,
  insertedRows: [] as Array<Record<string, unknown>>,
  conflictingEmails: new Set<string>(),
  externalConflicts: new Map<string, string>(),
}));

const mockTx = { tag: 'tenant-tx' };

// The writer is unit-tested against PostgreSQL in db/__tests__/member-import-identity.postgres.test.ts; here it is a faithful stand-in.
class MembershipImportConflictError extends Error {}
const importMemberships = vi.fn(async (_tx: unknown, organizationId: string, candidates: Array<{ line: number; userId: string; email: string; name: string; external?: { source: string; id: string } }>) => {
  const outcome = { inserted: 0, bound: 0, unchanged: 0, conflicts: [] as Array<{ row: number; reason: string }> };
  for (const candidate of candidates) {
    if (m.insertShouldFail) throw new Error('insert failed');
    if (m.raceOnInsert) throw new MembershipImportConflictError('Another change bound the same member identity at the same time; nothing was imported');
    if (m.externalConflicts.has(candidate.email)) { outcome.conflicts.push({ row: candidate.line, reason: m.externalConflicts.get(candidate.email)! }); continue; }
    if (m.conflictingEmails.has(candidate.email)) {
      if (candidate.external) outcome.bound++; else outcome.unchanged++;
      continue;
    }
    m.insertedRows.push({ organizationId, userId: candidate.userId, email: candidate.email, name: candidate.name, role: 'member', external: candidate.external });
    outcome.inserted++;
  }
  return outcome;
});

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: m.ApiError,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/membership/import-memberships', () => ({ importMemberships, MembershipImportConflictError }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@nzila/platform-auth/entra/server', () => ({
  adminClient: { users: { getUserList: m.getUserList } },
}));

async function loadRoute() {
  return import('../members/import/route');
}

const csv = (content: string, sourceSystem?: string) => {
  const form = new FormData();
  form.append('file', new File([content], 'members.csv', { type: 'text/csv' }));
  if (sourceSystem !== undefined) form.append('source_system', sourceSystem);
  return new NextRequest('http://localhost/api/members/import', { method: 'POST', body: form });
};

describe('members/import route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.insertShouldFail = false;
    m.raceOnInsert = false;
    m.insertedRows = [];
    m.conflictingEmails = new Set();
    m.externalConflicts = new Map();
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));
    // By default every email resolves to exactly one directory identity (tests of unresolved identities override this).
    m.getUserList.mockImplementation(async ({ emailAddress }: { emailAddress: string[] }) => ({ data: [{ id: `entra_${emailAddress[0]}` }] }));
    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'steward_1' }) => {
          try {
            const data = await handler({ request, ...ctx });
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('POST returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(csv('email,name\na@example.com,A'), {});
    expect(response.status).toBe(400);
  });

  it('POST returns 400 when file is not provided', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/members/import', {
      method: 'POST',
      body: new FormData(),
    }));

    expect(response.status).toBe(400);
  });

  it('POST returns zero processed for header-only CSV and writes nothing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(csv('email,name'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.processed).toBe(0);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST imports rows as plain members, uses the Entra lookup, and audits on the same transaction', async () => {
    const { POST } = await loadRoute();
    m.getUserList.mockResolvedValueOnce({ data: [{ id: 'entra_u1' }] });

    const response = await POST(csv('email,name,role\na@example.com,Alpha,member'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.processed).toBe(1);
    expect(m.getUserList).toHaveBeenCalled();
    expect(m.insertedRows[0]).toMatchObject({ organizationId: 'org_1', userId: 'entra_u1', role: 'member' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'steward_1', action: 'member.import' }),
    );
  });

  it('POST never imports an elevated role from the CSV', async () => {
    const { POST } = await loadRoute();

    const response = await POST(csv('email,name,role\nboss@example.com,Boss,admin\nplain@example.com,Plain,member'));

    const json = await response.json();
    expect(json.processed).toBe(1);
    expect(json.skipped).toBe(1);
    expect(m.insertedRows).toHaveLength(1);
    expect(m.insertedRows[0]).toMatchObject({ email: 'plain@example.com', role: 'member' });
  });

  it('POST counts rows that already exist as skipped and writes no audit when nothing was imported', async () => {
    const { POST } = await loadRoute();
    m.conflictingEmails.add('a@example.com');

    const response = await POST(csv('email,name\na@example.com,Alpha'));

    const json = await response.json();
    expect(json.processed).toBe(0);
    expect(json.skipped).toBe(1);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST fails the whole import when a write fails, and when its audit fails', async () => {
    const { POST } = await loadRoute();
    m.insertShouldFail = true;
    expect((await POST(csv('email,name\na@example.com,Alpha'))).status).toBe(500);

    m.insertShouldFail = false;
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    expect((await POST(csv('email,name\na@example.com,Alpha'))).status).toBe(500);
  });

  // ─── Identity resolution: an import never mints a person ─────────────────

  it('POST does not import a row whose email has no directory identity, and reports it by row number', async () => {
    const { POST } = await loadRoute();
    m.getUserList.mockImplementation(async ({ emailAddress }: { emailAddress: string[] }) =>
      ({ data: emailAddress[0] === 'known@example.com' ? [{ id: 'entra_known' }] : [] }));

    const response = await POST(csv('email,name\nunknown@example.com,Unknown\nknown@example.com,Known'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.processed).toBe(1);
    expect(json.skipped).toBe(1);
    expect(json.unresolved).toEqual([{ row: 2, reason: 'NO_DIRECTORY_IDENTITY' }]);
    expect(m.insertedRows).toHaveLength(1);
    expect(m.insertedRows[0]).toMatchObject({ userId: 'entra_known', email: 'known@example.com' });
  });

  it('POST imports the same unknown person twice without ever creating a membership', async () => {
    const { POST } = await loadRoute();
    m.getUserList.mockResolvedValue({ data: [] });

    for (let attempt = 0; attempt < 2; attempt++) {
      const json = await (await POST(csv('email,name\nghost@example.com,Ghost'))).json();
      expect(json.processed).toBe(0);
      expect(json.unresolved).toEqual([{ row: 2, reason: 'NO_DIRECTORY_IDENTITY' }]);
    }
    expect(m.insertedRows).toHaveLength(0);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST refuses an email that matches more than one directory identity', async () => {
    const { POST } = await loadRoute();
    m.getUserList.mockResolvedValue({ data: [{ id: 'entra_a' }, { id: 'entra_b' }] });

    const json = await (await POST(csv('email,name\nshared@example.com,Shared'))).json();

    expect(json.processed).toBe(0);
    expect(json.unresolved).toEqual([{ row: 2, reason: 'AMBIGUOUS_DIRECTORY_IDENTITY' }]);
    expect(m.insertedRows).toHaveLength(0);
  });

  it('POST fails the whole import, writing nothing, when the directory lookup fails', async () => {
    const { POST } = await loadRoute();
    m.getUserList
      .mockResolvedValueOnce({ data: [{ id: 'entra_first' }] })
      .mockRejectedValueOnce(new Error('directory unavailable'));

    const response = await POST(csv('email,name\nfirst@example.com,First\nsecond@example.com,Second'));

    expect(response.status).toBe(502);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.insertedRows).toHaveLength(0);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST imports an email that appears twice in the file once, and reports the repeat', async () => {
    const { POST } = await loadRoute();

    const json = await (await POST(csv('email,name\nsame@example.com,Same\nSAME@example.com,Same Again'))).json();

    expect(json.processed).toBe(1);
    expect(json.unresolved).toEqual([{ row: 3, reason: 'DUPLICATE_IN_FILE' }]);
    expect(m.insertedRows).toHaveLength(1);
  });

  // ─── Stable external member identity ─────────────────────────────────────

  it('POST refuses external member ids that no source_system names', async () => {
    const { POST } = await loadRoute();
    const response = await POST(csv('email,name,external_member_id\na@example.com,A,000123'));
    expect(response.status).toBe(400);
    expect(importMemberships).not.toHaveBeenCalled();
  });

  it('POST passes each external id, with its source and CSV line, to the reconciling writer', async () => {
    const { POST } = await loadRoute();
    const json = await (await POST(csv('email,name,external_member_id\na@example.com,A,000123\nb@example.com,B,', 'registry'))).json();

    expect(json.processed).toBe(2);
    const [, organizationId, candidates] = importMemberships.mock.calls[0];
    expect(organizationId).toBe('org_1');
    expect(candidates).toEqual([
      expect.objectContaining({ line: 2, userId: 'entra_a@example.com', external: { source: 'registry', id: '000123' } }),
      expect.not.objectContaining({ external: expect.anything() }),
    ]);
  });

  it('POST reports a repeated external id in the file and imports only the first', async () => {
    const { POST } = await loadRoute();
    const json = await (await POST(csv('email,name,external_member_id\na@example.com,A,77\nb@example.com,B,77', 'registry'))).json();
    expect(json.processed).toBe(1);
    expect(json.unresolved).toEqual([{ row: 3, reason: 'DUPLICATE_EXTERNAL_ID_IN_FILE' }]);
  });

  it('POST reports identity conflicts from the writer by row, and audits bindings', async () => {
    const { POST } = await loadRoute();
    m.externalConflicts.set('taken@example.com', 'EXTERNAL_ID_BOUND_TO_OTHER_MEMBER');
    m.conflictingEmails.add('existing@example.com');

    const json = await (await POST(csv('email,name,external_member_id\ntaken@example.com,T,1\nexisting@example.com,E,2', 'registry'))).json();

    expect(json.processed).toBe(0);
    expect(json.bound).toBe(1);
    expect(json.unresolved).toEqual([{ row: 2, reason: 'EXTERNAL_ID_BOUND_TO_OTHER_MEMBER' }]);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({
      details: expect.objectContaining({ imported: 0, bound: 1, sourceSystem: 'registry' }),
    }));
  });

  it('POST answers 409, with nothing written, when a concurrent change bound the same identity', async () => {
    const { POST } = await loadRoute();
    m.raceOnInsert = true;
    const response = await POST(csv('email,name\na@example.com,A'));
    expect(response.status).toBe(409);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});
