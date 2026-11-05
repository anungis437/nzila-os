import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER_ID = 'user_test_001';
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
const SESSION_ID = '00000000-0000-0000-0000-000000000999';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    insertQueue: [] as unknown[][],
    executeQueue: [] as unknown[][],
    updates: [] as Array<Record<string, unknown>>,
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const nextInsert = () => Promise.resolve((state.insertQueue.shift() ?? [{ id: 'fallback-id' }]) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  const createInsertChain = () => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => nextInsert()),
    })),
  });

  const createUpdateChain = () => ({
    set: vi.fn((values: Record<string, unknown>) => {
      state.updates.push(values);
      return { where: vi.fn(async () => []) };
    }),
  });

  return {
    state,
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    queueInsert: (...results: unknown[][]) => state.insertQueue.push(...results),
    queueExecute: (...results: unknown[][]) => state.executeQueue.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
      state.insertQueue = [];
      state.executeQueue = [];
      state.updates = [];
    },
    hasCaseFilingCapacity: vi.fn(),
    persistAtomicAudit: vi.fn(),
    auditLog: vi.fn(),
    trackPilotEvent: vi.fn(),
    withRLSContext: vi.fn(),
    createSelectChain,
    createInsertChain,
    createUpdateChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  insert: vi.fn(() => m.createInsertChain()),
  update: vi.fn(() => m.createUpdateChain()),
  execute: vi.fn(() => m.state.executeQueue.shift() ?? Promise.resolve([])),
};

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/cases/case-authorization', () => ({ hasCaseFilingCapacity: m.hasCaseFilingCapacity }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: {
    DATA_CREATE: 'data.create',
  },
  AuditSeverity: {
    MEDIUM: 'medium',
    HIGH: 'high',
  },
}));
vi.mock('@/lib/services/pilot-tracking', () => ({
  trackPilotEvent: m.trackPilotEvent,
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/import/route');
}

const importRequest = (body: unknown, raw = false) => new NextRequest('http://localhost/api/grievances/import', {
  method: 'POST',
  body: raw ? (body as string) : JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
});
const validRow = {
  type: 'individual',
  title: 'Valid grievance title',
  description: 'Valid grievance description with sufficient details for schema checks.',
  createOfficialCase: true,
};

describe('grievances/import route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    resetCaller();
    caller.userId = TEST_USER_ID;
    caller.organizationId = TEST_ORG_ID;
    m.hasCaseFilingCapacity.mockResolvedValue(true);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
    mockDb.execute.mockImplementation(() => m.state.executeQueue.shift() ?? Promise.resolve([]));
  });

  it('declares what it asks of the wrapper: POST commits row by row in transactions of its own, GET reads in the tenant transaction', async () => {
    await loadRoute();
    const post = declared.find((entry) => entry.openapi?.summary === 'Import grievances from CSV or JSON');
    expect(post?.auth).toEqual({ required: true });
    expect(post?.entitlement).toBe('grievance_case_suite');
    expect(post?.requireOrg).toBe(false);
    expect(post?.rlsOrgContext).toBeUndefined();
    const get = declared.find((entry) => entry.openapi?.summary === 'List import sessions or read one with its records');
    expect(get?.auth).toEqual({ required: true });
    expect(get?.entitlement).toBe('grievance_case_suite');
    expect(get?.rlsOrgContext).toBe(true);
  });

  it('answers 403 when the caller has no organization, before reading the body', async () => {
    caller.organizationId = null;
    const { POST } = await loadRoute();
    const response = await POST(importRequest({ format: 'json', payload: [validRow] }));
    expect(response.status).toBe(403);
    expect(m.hasCaseFilingCapacity).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns forbidden and writes nothing when the membership lacks bulk filing capacity', async () => {
    const { POST } = await loadRoute();
    m.hasCaseFilingCapacity.mockResolvedValueOnce(false);

    const response = await POST(importRequest({ format: 'json', payload: [] }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN', message: 'Importing cases requires an officer or executive capacity' });
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({ userId: TEST_USER_ID, organizationId: TEST_ORG_ID }, 'bulk');
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  }, 60000);

  it('GET returns forbidden when the membership lacks bulk filing capacity', async () => {
    const { GET } = await loadRoute();
    m.hasCaseFilingCapacity.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/grievances/import'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN', message: 'Viewing import sessions requires an officer or executive capacity' });
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({ userId: TEST_USER_ID, organizationId: TEST_ORG_ID }, 'bulk');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns validation error for malformed JSON payloads', async () => {
    const { POST } = await loadRoute();
    const response = await POST(importRequest('{bad-json', true));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON request body',
    });
  });

  it('returns validation error when import payload has no rows', async () => {
    const { POST } = await loadRoute();
    const response = await POST(importRequest({ format: 'json', payload: [] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'No rows found in import payload',
    });
  });

  it('rejects an oversized authenticated import before creating a batch', async () => {
    const { POST } = await loadRoute();
    const response = await POST(importRequest({ format: 'csv', payload: 'x'.repeat(2 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('rejects more than 500 rows without any database writes', async () => {
    const { POST } = await loadRoute();
    const response = await POST(importRequest({
      format: 'json',
      payload: Array.from({ length: 501 }, () => ({ title: 'Valid title', description: 'Valid description' })),
    }));
    expect(response.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('rejects an oversized CSV row count before any batch is created', async () => {
    const { POST } = await loadRoute();
    const csv = ['title,description', ...Array.from({ length: 501 }, (_, i) => `Title ${i},Description sufficient for import`)].join('\n');
    const response = await POST(importRequest({ format: 'csv', payload: csv }));
    expect(response.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('rejects unknown import sessions when importSessionId is supplied', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([]);

    const response = await POST(importRequest({
      format: 'json',
      payload: [{ title: 'Valid grievance title', description: 'Long enough grievance description value for validation.' }],
      importSessionId: SESSION_ID,
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('imports rows and returns a partial summary (the stored status fits ingestion_batches.status, varchar(20)) when one row fails validation', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([
      { id: 'batch-1' },
      { id: 'record-1' },
      { id: 'grievance-1', grievanceNumber: 'GRV-IMP-1', status: 'filed' },
      { id: 'record-2' },
    ]);
    m.queueExecute([], []);

    const response = await POST(importRequest({
      format: 'json',
      payload: [
        validRow,
        {
          type: 'individual',
          title: 'Bad',
          description: 'too short',
          createOfficialCase: false,
        },
      ],
      sourceSystem: 'test-suite-import',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      importSessionId: 'batch-1',
      status: 'partial',
      importedRows: 1,
      failedRows: 1,
    });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ action: 'grievance.import_row', organizationId: TEST_ORG_ID, userId: TEST_USER_ID }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      action: 'grievance.import_batch',
      resourceType: 'ingestion_batches',
      resourceId: 'batch-1',
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
    }));
    expect(m.trackPilotEvent).toHaveBeenCalled();
    expect(m.auditLog).not.toHaveBeenCalled();
  });

  it('commits each unit of work in its own organization transaction: the session, every row, and the closing of the session', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([{ id: 'batch-1' }]);
    const response = await POST(importRequest({ format: 'json', payload: [validRow, { ...validRow, title: 'Second valid grievance title' }], sourceSystem: 'test-suite-import' }));
    expect(response.status).toBe(200);
    // One for the session, one per row, one to close the session; each names the caller's own organization.
    expect(m.withRLSContext).toHaveBeenCalledTimes(1 + 2 + 1);
    for (const call of m.withRLSContext.mock.calls) expect(call[0]).toEqual({ organizationId: TEST_ORG_ID });
    // Telemetry for a row is recorded on that row's transaction, not on the ambient handle.
    for (const call of m.trackPilotEvent.mock.calls) expect(call[1]).toBe(mockDb);
  });

  it('closes the session as failed, keeps what was imported and fails the request when a row hits an unexpected fault', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([{ id: 'batch-1' }]);
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action?: string }) => {
      if (entry.action === 'grievance.import_row') throw new Error('audit sink unavailable');
    });

    const response = await POST(importRequest({ format: 'json', payload: [validRow], sourceSystem: 'test-suite-import' }));

    expect(response.status).toBe(500);
    expect(m.state.updates.at(-1)).toMatchObject({ status: 'failed' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ action: 'grievance.import_batch', resourceId: 'batch-1' }));
  });

  it('does not report a completed import when the batch audit write fails', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([
      { id: 'batch-1' },
      { id: 'record-1' },
      { id: 'grievance-1', grievanceNumber: 'GRV-IMP-1', status: 'filed' },
    ]);
    m.queueExecute([]);
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action?: string }) => {
      if (entry.action === 'grievance.import_batch') throw new Error('audit failed');
    });

    const response = await POST(importRequest({ format: 'json', payload: [validRow], sourceSystem: 'test-suite-import' }));

    expect(response.status).toBe(500);
  });

  it('lists recent sessions when GET has no importSessionId', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([
      {
        id: 'batch-1',
        status: 'completed',
        totalRecords: 2,
        createdAt: new Date('2026-06-11T00:00:00.000Z'),
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/grievances/import'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.sessions).toHaveLength(1);
  });

  it('refuses an importSessionId that is not a uuid instead of sending it to the database', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/grievances/import?importSessionId=batch-1'));
    expect(response.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns a specific session with records on GET importSessionId lookup', async () => {
    const { GET } = await loadRoute();
    m.queueSelect(
      [{ id: SESSION_ID, status: 'completed_with_errors', organizationId: TEST_ORG_ID }],
      [{ id: 'record-1', status: 'succeeded', recordIndex: 0 }],
    );

    const response = await GET(new NextRequest(`http://localhost/api/grievances/import?importSessionId=${SESSION_ID}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.session).toMatchObject({ id: SESSION_ID });
    expect(payload.data.records).toHaveLength(1);
  });

  it('answers 404 for a session of another organization', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([]);
    const response = await GET(new NextRequest(`http://localhost/api/grievances/import?importSessionId=${SESSION_ID}`));
    expect(response.status).toBe(404);
  });
});
