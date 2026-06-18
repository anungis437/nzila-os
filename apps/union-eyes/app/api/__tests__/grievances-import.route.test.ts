import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER_ID = 'user_test_001';
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    insertQueue: [] as unknown[][],
    executeQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const nextInsert = () => Promise.resolve((state.insertQueue.shift() ?? [{ id: 'fallback-id' }]) as unknown[]);
  const nextExecute = () => Promise.resolve((state.executeQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
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
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
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
    },
    requireEntitlement: vi.fn(),
    hasMinRole: vi.fn(),
    auditDataMutation: vi.fn(),
    auditLog: vi.fn(),
    trackPilotEvent: vi.fn(),
    withRLSContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
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

vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn(
    (handler: (req: NextRequest, ctx: { organizationId: string; userId: string }) => Promise<Response>) =>
      (req: NextRequest) =>
        handler(req, { organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
  ),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditDataMutation: m.auditDataMutation,
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

async function loadRoute() {
  return import('../grievances/import/route');
}

describe('grievances/import route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.auditDataMutation.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
    mockDb.execute.mockResolvedValue([]);
  });

  it('returns forbidden when caller lacks steward role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/grievances/import', {
      method: 'POST',
      body: JSON.stringify({ format: 'json', payload: [] }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  }, 60000);

  it('returns validation error for malformed JSON payloads', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/grievances/import', {
      method: 'POST',
      body: '{bad-json',
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON request body',
    });
  });

  it('returns validation error when import payload has no rows', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/grievances/import', {
      method: 'POST',
      body: JSON.stringify({ format: 'json', payload: [] }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'No rows found in import payload',
    });
  });

  it('rejects unknown import sessions when importSessionId is supplied', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([]);

    const response = await POST(new NextRequest('http://localhost/api/grievances/import', {
      method: 'POST',
      body: JSON.stringify({
        format: 'json',
        payload: [{ title: 'Valid grievance title', description: 'Long enough grievance description value for validation.' }],
        importSessionId: '00000000-0000-0000-0000-000000000999',
      }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('imports rows and returns a completed_with_errors summary when one row fails validation', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([
      { id: 'batch-1' },
      { id: 'record-1' },
      { id: 'grievance-1', grievanceNumber: 'GRV-IMP-1', status: 'filed' },
      { id: 'record-2' },
    ]);
    m.queueExecute([], []);

    const response = await POST(new NextRequest('http://localhost/api/grievances/import', {
      method: 'POST',
      body: JSON.stringify({
        format: 'json',
        payload: [
          {
            type: 'individual',
            title: 'Valid grievance title',
            description: 'Valid grievance description with sufficient details for schema checks.',
            createOfficialCase: true,
          },
          {
            type: 'individual',
            title: 'Bad',
            description: 'too short',
            createOfficialCase: false,
          },
        ],
        sourceSystem: 'test-suite-import',
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      importSessionId: 'batch-1',
      status: 'completed_with_errors',
      totalRows: 2,
      importedRows: 1,
      failedRows: 1,
    });
    expect(m.auditDataMutation).toHaveBeenCalled();
    expect(m.trackPilotEvent).toHaveBeenCalled();
    expect(m.auditLog).toHaveBeenCalled();
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

  it('returns a specific session with records on GET importSessionId lookup', async () => {
    const { GET } = await loadRoute();
    m.queueSelect(
      [{ id: 'batch-1', status: 'completed_with_errors', organizationId: TEST_ORG_ID }],
      [{ id: 'record-1', status: 'succeeded', recordIndex: 0 }],
    );

    const response = await GET(new NextRequest('http://localhost/api/grievances/import?importSessionId=batch-1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.session).toMatchObject({ id: 'batch-1' });
    expect(payload.data.records).toHaveLength(1);
  });
});