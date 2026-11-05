import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: {
    badRequest: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 400 })),
    notFound: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 404 })),
    conflict: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 409 })),
  },
  selectQueue: [] as unknown[][],
  updateReturningQueue: [] as unknown[][],
  audit: vi.fn(),
  updates: [] as Array<{ table: unknown; set: Record<string, unknown> }>,
}));

const mockDb = {
  select: vi.fn(() => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
  update: vi.fn((table: unknown) => ({
    set: vi.fn((set: Record<string, unknown>) => (m.updates.push({ table, set }), {
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateReturningQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(async () => undefined),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: m.ApiError,
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_o: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockDb) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/knowledge-transfer/governance/consent-controls', () => ({
  SENSITIVITY_LEVELS: {
    public_internal: { indexingAllowed: true, description: 'Internal' },
    restricted: { indexingAllowed: false, description: 'Restricted' },
    privileged: { indexingAllowed: false, description: 'Privileged' },
    legal_sensitive: { indexingAllowed: false, description: 'Legal' },
    executive_confidential: { indexingAllowed: false, description: 'Executive' },
  },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn((...a: unknown[]) => ['and', ...a]),
    eq: vi.fn((col: unknown, val: unknown) => ['eq', (col as { name?: string })?.name, val]),
    or: vi.fn((...a: unknown[]) => ['or', ...a]),
  };
});

async function loadRoute() {
  return import('../exit-interviews/[id]/governance/route');
}

describe('exit-interviews/[id]/governance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.audit.mockResolvedValue(undefined);
    m.selectQueue = [];
    m.updateReturningQueue = [];
    m.updates = [];
    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (_request: NextRequest, ctx: any = { params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1', body: {} }) => {
          try {
            const data = await handler(ctx);
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('PATCH returns 400 when governance fields are missing', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1', body: {},
    });
    expect(response.status).toBe(400);
  });

  it('PATCH returns 404 when interview is not found', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([]);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1', body: { consentGranted: true },
    });

    expect(response.status).toBe(404);
  });

  // Retiree consent is the retiring employee's: an administrator's checkbox or note does not create it.
  it('PATCH refuses to record a consent grant with 409 and writes or audits nothing', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: false }]);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
      body: { sensitivityLevel: 'public_internal', consentGranted: true, consentNotes: 'consent on file' },
    });

    expect(response.status).toBe(409);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('the body schema is strict: an unknown field (such as a consent timestamp) is rejected', async () => {
    vi.resetModules();
    await loadRoute();
    const config = m.withApi.mock.calls.at(-1)![0] as { body: { safeParse: (v: unknown) => { success: boolean } } };
    expect(config.body.safeParse({ consentGranted: false }).success).toBe(true);
    expect(config.body.safeParse({ consentGranted: false, consentGrantedAt: '2026-01-01' }).success).toBe(false);
    expect(config.body.safeParse({ sensitivityLevel: 'restricted', consentGrantedBy: 'u1' }).success).toBe(false);
  });

  it('PATCH changes the sensitivity level without touching consent', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: true }]);
    m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
      body: { sensitivityLevel: 'public_internal' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.sensitivityLevel).toBe('public_internal');
    expect(json.indexingEligible).toBe(true);
    expect(m.updates[0].set).not.toHaveProperty('consentGranted');
    // Consent stands, so the knowledge-base copy is left alone.
    expect(m.updates).toHaveLength(1);
  });

  it('PATCH withdrawal deactivates the knowledge-base copy in the same transaction, and audits it', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true, knowledgeBaseId: 'kb_1' }]);
    m.updateReturningQueue.push(
      [{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: false, knowledgeBaseId: 'kb_1' }],
      [{ id: 'kb_1' }],
    );

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-1', body: { consentGranted: false },
    });

    expect(response.status).toBe(200);
    const { knowledgeBase } = await import('@/db/schema');
    expect(m.updates).toHaveLength(2);
    expect(m.updates[0].set).toMatchObject({ consentGranted: false, consentGrantedAt: null, consentGrantedBy: null });
    expect(m.updates[1].table).toBe(knowledgeBase);
    expect(m.updates[1].set).toMatchObject({ isActive: false });
    const { eq } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith(knowledgeBase.organizationId, 'org_1');
    expect(eq).toHaveBeenCalledWith(knowledgeBase.sourceType, 'exit_interview');
    expect(eq).toHaveBeenCalledWith(knowledgeBase.sourceId, 'iv_1');
    expect(eq).toHaveBeenCalledWith(knowledgeBase.id, 'kb_1');
    expect(m.audit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      details: expect.objectContaining({ newConsent: false, deactivatedKnowledgeBaseIds: ['kb_1'] }),
    }));
  });

  it('PATCH supports consent revocation path', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);
    m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: false }]);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
      body: { consentGranted: false, sensitivityLevel: 'restricted' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.consentGranted).toBe(false);
    expect(json.indexingEligible).toBe(false);
  });
});
