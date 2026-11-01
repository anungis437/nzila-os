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
      expect.objectContaining({ action: 'report.execute.denied', details: { dataSource: 'claims', restricted: ['claims.claim_number'] } }),
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

  it('records which fields, filters and classes were disclosed and never a filter value or a row', async () => {
    m.hasMinRole.mockResolvedValue(false);
    m.execute.mockResolvedValue({ success: true, data: [{ status: 'open', id_count: 30, ue_group_size: 30, ue_group_people: 20 }], rowCount: 1, executionTimeMs: 1 });

    await run({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'status', fieldName: 'Status' }, claimCount.fields[0]],
      groupBy: ['status'],
      filters: [{ fieldId: 'priority', operator: 'eq', value: 'a-secret-priority' }],
    });

    const entry = m.audit.mock.calls.map((call) => call[1]).find((e) => e.action === 'report.execute');
    expect(entry.details).toMatchObject({
      authority: 'officer',
      classesReturned: ['matter'],
      filteredBy: ['claims.priority'],
      groupedBy: ['claims.status'],
      fieldPolicy: { approvedBy: null },
    });
    expect(entry.details.fields).toEqual(['claims.status', 'claims.id']);
    expect(JSON.stringify(entry)).not.toContain('a-secret-priority');
    expect(JSON.stringify(entry)).not.toContain('"rows"');
  });

  it('bounds how often an officer may ask the same question with different values, records the refusal, and runs nothing', async () => {
    m.hasMinRole.mockResolvedValue(false);
    m.checkRateLimit.mockImplementation(async (key: string) => (String(key).startsWith('report-shape:') ? { allowed: false, resetIn: 900 } : { allowed: true, resetIn: 0 }));

    const response = await run({ ...claimCount, filters: [{ fieldId: 'priority', operator: 'eq', value: 'high' }] });

    expect(response.status).toBe(429);
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'report.execute.denied', details: expect.objectContaining({ reason: 'repeated_question_shape' }) }),
      'failure',
    );
    const key = String(m.checkRateLimit.mock.calls.find((call) => String(call[0]).startsWith('report-shape:'))?.[0]);
    expect(key).toContain('org_1:u1:');
  });

  it('bounds one source across shapes and across the organization\'s officers, so a new shape does not reset the budget', async () => {
    m.hasMinRole.mockResolvedValue(false);
    m.checkRateLimit.mockImplementation(async (key: string) => (String(key).startsWith('report-source:') ? { allowed: false, resetIn: 1200 } : { allowed: true, resetIn: 0 }));

    const response = await run({ ...claimCount, filters: [{ fieldId: 'priority', operator: 'ne', value: 'none-such' }] });

    expect(response.status).toBe(429);
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'report.execute.denied', details: expect.objectContaining({ reason: 'repeated_questions_of_one_source' }) }),
      'failure',
    );
    expect(String(m.checkRateLimit.mock.calls.find((call) => String(call[0]).startsWith('report-source:'))?.[0])).toBe('report-source:org_1:claims');
  });

  it.each([
    ['a day', '2026-03-14'],
    ['a single instant', '2026-03-01T09:30:00Z'],
  ])('refuses an officer a date filter that cuts at %s, records it, and runs nothing', async (_name, value) => {
    m.hasMinRole.mockResolvedValue(false);

    const response = await run({ ...claimCount, filters: [{ fieldId: 'created_at', operator: 'gte', value }] });

    expect(response.status).toBe(403);
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'report.execute.denied', details: expect.objectContaining({ restricted: expect.arrayContaining(['claims.created_at (date filter finer than a month)']) }) }),
      'failure',
    );
    expect(JSON.stringify(m.audit.mock.calls)).not.toContain(value);
  });

  it('lets an officer filter on month boundaries, and an administrator on any date', async () => {
    m.hasMinRole.mockResolvedValue(false);
    expect((await run({ ...claimCount, filters: [{ fieldId: 'created_at', operator: 'between', values: ['2026-03-01', '2026-04-01'] }] })).status).toBe(200);

    m.hasMinRole.mockResolvedValue(true);
    expect((await run({ ...claimCount, filters: [{ fieldId: 'created_at', operator: 'eq', value: '2026-03-14' }] })).status).toBe(200);
  });
  it('does not spend the question budget on an administrator or on a row listing an officer may run', async () => {
    m.hasMinRole.mockResolvedValue(true);
    await run(claimCount);
    m.hasMinRole.mockResolvedValue(false);
    await run({ dataSourceId: 'organization_members', fields: [{ fieldId: 'status', fieldName: 'Status' }] });

    expect(m.checkRateLimit.mock.calls.some((call) => String(call[0]).startsWith('report-shape:'))).toBe(false);
  });

  it('runs every report inside the caller\'s own organization whatever the body names, and refuses a filter on the organization column', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const refused = await run({ ...claimCount, filters: [{ fieldId: 'organization_id', operator: 'eq', value: 'org_2' }] });
    expect(refused.status).toBe(400);
    expect(m.execute).not.toHaveBeenCalled();

    const response = await run({ ...claimCount, organizationId: 'org_2' });
    expect(response.status).toBe(200);
    expect(m.execute).toHaveBeenCalledTimes(1);
  });
});

describe('reports/execute small-group suppression (F06 A5)', () => {
  const grouped = { dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 'Status' }, { fieldId: 'id', fieldName: 'Claims', aggregation: 'count' }], groupBy: ['status'] };
  const run = async (config: unknown) => {
    const { POST } = await import('../reports/execute/route');
    return POST(
      new NextRequest('http://localhost/api/reports/execute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config }) }),
      { userId: 'u1', organizationId: 'org_1' },
    );
  };
  const rows = [
    { status: 'open', id_count: 12, ue_group_size: 12, ue_group_people: 12 },
    { status: 'rare', id_count: 2, ue_group_size: 2, ue_group_people: 2 },
    { status: 'edge', id_count: 5, ue_group_size: 5, ue_group_people: 5 },
    { status: 'many', id_count: 9, ue_group_size: 9, ue_group_people: 9 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.audit.mockReset().mockResolvedValue(undefined);
    m.execute.mockResolvedValue({ success: true, data: rows.map((r) => ({ ...r })), rowCount: 4, executionTimeMs: 3 });
  });

  it('has the server add its own counts, withholds groups under five and the smallest neighbour, strips the counts, and says how many were withheld', async () => {
    m.hasMinRole.mockResolvedValue(false);

    const body = await (await run(grouped)).json();

    const sent = m.execute.mock.calls[0][0];
    expect(sent.fields.at(-1)).toMatchObject({ fieldId: 'id', table: 'claims', aggregation: 'count_distinct', alias: 'ue_group_size' });
    expect(sent.fields.at(-2)).toMatchObject({ fieldId: 'member_id', table: 'claims', aggregation: 'count_distinct', alias: 'ue_group_people' });
    // 'rare' is withheld for its size; 'edge', the smallest released cell, goes with it so the pair cannot be recovered by subtraction.
    expect(body.data).toEqual([{ status: 'open', id_count: 12 }, { status: 'many', id_count: 9 }]);
    expect(JSON.stringify(body)).not.toContain('ue_group_');
    expect(body).toMatchObject({ rowCount: 2, suppressedGroups: 2 });
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'report.execute', details: expect.objectContaining({ suppressedGroups: 2 }) }));
  });

  it('withholds a group with many claims but fewer than five people behind them', async () => {
    m.hasMinRole.mockResolvedValue(false);
    m.execute.mockResolvedValue({
      success: true,
      data: [{ status: 'open', id_count: 40, ue_group_size: 40, ue_group_people: 3 }, { status: 'closed', id_count: 30, ue_group_size: 30, ue_group_people: 20 }, { status: 'stale', id_count: 20, ue_group_size: 20, ue_group_people: 12 }],
      rowCount: 3,
      executionTimeMs: 1,
    });

    const body = await (await run(grouped)).json();

    expect(body.data.map((r: { status: string }) => r.status)).toEqual(['closed']);
  });

  it('does not suppress for an administrator or add a column', async () => {
    m.hasMinRole.mockResolvedValue(true);
    m.execute.mockResolvedValue({ success: true, data: [{ status: 'rare', id_count: 2 }], rowCount: 1, executionTimeMs: 1 });

    const body = await (await run(grouped)).json();

    expect(m.execute.mock.calls[0][0].fields).toHaveLength(2);
    expect(body.data).toEqual([{ status: 'rare', id_count: 2 }]);
    expect(body).not.toHaveProperty('suppressedGroups');
  });

  it('withholds an ungrouped officer aggregate over fewer than five people and releases one over enough', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const total = { dataSourceId: 'claims', fields: [{ fieldId: 'id', fieldName: 'Claims', aggregation: 'count' }] };

    m.execute.mockResolvedValue({ success: true, data: [{ id_count: 3, ue_group_size: 3, ue_group_people: 3 }], rowCount: 1, executionTimeMs: 1 });
    const small = await (await run(total)).json();
    expect(small.data).toEqual([]);
    expect(small).toMatchObject({ suppressedGroups: 1 });

    m.execute.mockResolvedValue({ success: true, data: [{ id_count: 30, ue_group_size: 30, ue_group_people: 25 }], rowCount: 1, executionTimeMs: 1 });
    const large = await (await run(total)).json();
    expect(large.data).toEqual([{ id_count: 30 }]);
  });
});