import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  execute: vi.fn(),
  logApiAuditEvent: vi.fn(),
  hasMinRole: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: (...args: unknown[]) => m.hasMinRole(...args),
  withRoleAuth: vi.fn(
    (_role: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) =>
      (req: NextRequest, ctx: any = {}) => handler(req, ctx),
  ),
}));

// The execution is recorded durably (B95); the writer has its own coverage.
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: (...args: unknown[]) => m.audit(...args) }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { REPORT_EXECUTION: { requests: 30, window: 60 } },
}));

vi.mock('@/lib/report-executor', async (importOriginal) => ({
  // The data source registry is real: the route validates against it. Only the executor is replaced.
  getDataSource: (await importOriginal<typeof import('@/lib/report-executor')>()).getDataSource,
  ReportExecutor: class MockExecutor {
    constructor(_organizationId: string) {}
    execute = m.execute;
  },
}));

vi.mock('@/lib/middleware/api-security', () => ({
  logApiAuditEvent: m.logApiAuditEvent,
}));

async function loadRoute() {
  return import('../reports/execute/route');
}

describe('reports/execute route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    // Existing cases exercise execution mechanics as an administrator; the officer cases below set it false.
    m.hasMinRole.mockResolvedValue(true);
    m.audit.mockReset().mockResolvedValue(undefined);
    m.execute.mockResolvedValue({ success: true, data: [{ id: 1 }], rowCount: 1, executionTimeMs: 12 });
  });

  it('returns auth required when context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/reports/execute', { method: 'POST', body: '{}' }), {
      userId: '',
      organizationId: '',
    });

    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 15 });

    const response = await POST(
      new NextRequest('http://localhost/api/reports/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: {} }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(429);
  });

  it('returns validation error for invalid report config', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/reports/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: { dataSourceId: 'claims', fields: [] } }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 for disallowed data source', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/reports/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: {
            dataSourceId: 'forbidden_table',
            fields: [{ fieldId: 'id' }],
          },
        }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(400);
  });

  it('executes valid report config successfully', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/reports/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: {
            dataSourceId: 'claims',
            fields: [{ fieldId: 'id' }, { fieldId: 'status' }],
            filters: [{ fieldId: 'status', operator: 'equals', value: 'open' }],
          },
        }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, rowCount: 1 });
    expect(m.execute).toHaveBeenCalled();
  });

  it('returns internal error when executor throws', async () => {
    const { POST } = await loadRoute();
    m.execute.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(
      new NextRequest('http://localhost/api/reports/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: {
            dataSourceId: 'claims',
            fields: [{ fieldId: 'id' }],
          },
        }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(500);
  });

  // DEF-0B11-RPT-EXECUTE-FAILURE-IS-ANSWERED-200-WITH-NO-MESSAGE-AND-AUDITED-AS-SUCCESS-OR-AUTH-FAILED
  describe('a report that does not run', () => {
    const run = async () => {
      const { POST } = await loadRoute();
      return POST(
        new NextRequest('http://localhost/api/reports/execute', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config: { dataSourceId: 'claims', fields: [{ fieldId: 'status' }] } }),
        }),
        { userId: 'u1', organizationId: 'org_1' },
      );
    };
    const events = () => m.logApiAuditEvent.mock.calls.map(([event]) => event.eventType);

    it('answers 400 with the reason for a configuration the executor refuses, audited as a validation failure', async () => {
      m.execute.mockResolvedValue({ success: false, kind: 'invalid', error: 'Invalid field: nope', executionTimeMs: 1 });
      const response = await run();
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('Invalid field: nope');
      expect(events()).toEqual(['validation_failed']);
    });

    it('answers 500, not 200, for a query that failed, audited as a failure and never as a success', async () => {
      m.execute.mockResolvedValue({ success: false, kind: 'failed', error: 'Report execution failed', executionTimeMs: 1 });
      const response = await run();
      expect(response.status).toBe(500);
      expect(events()).toEqual(['failure']);
    });
  });
});

describe('reports/execute field authority (F06 A5)', () => {
  const run = async (config: unknown) => {
    const { POST } = await import('../reports/execute/route');
    return POST(
      new NextRequest('http://localhost/api/reports/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );
  };
  const claimRows = { dataSourceId: 'claims', fields: [{ fieldId: 'claim_number', fieldName: 'Claim Number' }] };
  const claimCount = { dataSourceId: 'claims', fields: [{ fieldId: 'id', fieldName: 'Claims', aggregation: 'count' }] };
  const memberEmail = { dataSourceId: 'organization_members', fields: [{ fieldId: 'email', fieldName: 'Email' }] };

  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.execute.mockResolvedValue({ success: true, data: [{ n: 3 }], rowCount: 1, executionTimeMs: 4 });
    m.audit.mockReset().mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(false);
  });

  it('refuses an officer a listing of claim rows, records the refusal, and runs nothing', async () => {
    const response = await run(claimRows);

    expect(response.status).toBe(403);
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'report.execute.denied', details: { dataSource: 'claims', restricted: ['claims'] } }),
      'failure',
    );
  });

  it.each([
    ['selecting', memberEmail],
    ['filtering on', { ...memberEmail, fields: [{ fieldId: 'id', fieldName: 'Id' , aggregation: 'count' }], filters: [{ fieldId: 'email', operator: 'ilike', value: '%a%' }] }],
    ['sorting by', { ...memberEmail, sortBy: [{ fieldId: 'email', direction: 'asc' }] }],
  ])('refuses an officer %s member e-mail, which would otherwise be a search oracle over addresses', async (_label, config) => {
    const response = await run(config);

    expect(response.status).toBe(403);
    expect(m.execute).not.toHaveBeenCalled();
  });

  it('lets an officer count claims, bounded to a capped page', async () => {
    const response = await run({ ...claimCount, limit: 100000 });

    expect(response.status).toBe(200);
    expect(m.execute).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'report.execute', details: expect.objectContaining({ adminOnlySelections: [], limit: 500 }) }));
  });

  it('lets an administrator list claim rows and member e-mail, recording that restricted data was selected', async () => {
    m.hasMinRole.mockResolvedValue(true);

    const rows = await run(claimRows);
    const email = await run(memberEmail);

    expect(rows.status).toBe(200);
    expect(email.status).toBe(200);
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'report.execute', details: expect.objectContaining({ adminOnlySelections: ['organization_members.email'] }) }),
    );
  });
});