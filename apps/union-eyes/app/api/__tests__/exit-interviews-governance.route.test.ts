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
  insertReturningQueue: [] as unknown[][],
  audit: vi.fn(),
  updates: [] as Array<{ table: unknown; set: Record<string, unknown> }>,
  inserted: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  erase: vi.fn(),
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
  insert: vi.fn((table: unknown) => ({
    values: vi.fn((values: Record<string, unknown>) => {
      m.inserted.push({ table, values });
      const resultPromise = Promise.resolve(undefined) as Promise<undefined> & { returning: () => Promise<unknown[]> };
      resultPromise.returning = vi.fn(async () => (m.insertReturningQueue.shift() ?? []) as unknown[]);
      return resultPromise;
    }),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: m.ApiError,
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_o: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockDb) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/ai/knowledge-base-embeddings', () => ({ eraseKnowledgeBaseEmbeddings: m.erase }));
vi.mock('@/lib/knowledge-transfer/governance/consent-controls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/knowledge-transfer/governance/consent-controls')>();
  return {
    ...actual,
    SENSITIVITY_LEVELS: {
      public_internal: { indexingAllowed: true, description: 'Internal' },
      restricted: { indexingAllowed: false, description: 'Restricted' },
      privileged: { indexingAllowed: false, description: 'Privileged' },
      legal_sensitive: { indexingAllowed: false, description: 'Legal' },
      executive_confidential: { indexingAllowed: false, description: 'Executive' },
    },
    // requiresReclassificationApproval is kept real: it is pure and the behavior under test.
  };
});
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
    m.erase.mockResolvedValue([]);
    m.selectQueue = [];
    m.updateReturningQueue = [];
    m.insertReturningQueue = [];
    m.updates = [];
    m.inserted = [];
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
    expect(config.body.safeParse({ approveReclassificationEventId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(config.body.safeParse({ sensitivityLevel: 'restricted', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }).success).toBe(true);
    expect(config.body.safeParse({ sensitivityLevel: 'restricted', expectedUpdatedAt: 'not-a-date' }).success).toBe(false);
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

  // DEF-0B7-EXC-CONSENT-WITHDRAWAL-AND-RECLASSIFICATION-WITHDRAW-NOTHING-DERIVED: the embedding is a derivative and is erased, not only hidden.
  it('PATCH withdrawal erases the embedding of the knowledge-base copy in the same transaction, and audits it', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true, knowledgeBaseId: 'kb_1' }]);
    m.updateReturningQueue.push(
      [{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: false, knowledgeBaseId: 'kb_1' }],
      [{ id: 'kb_1' }],
    );
    m.erase.mockResolvedValue(['kb_1']);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-1', body: { consentGranted: false },
    });

    expect(response.status).toBe(200);
    expect(m.erase).toHaveBeenCalledWith(mockDb, { organizationId: 'org_1', sourceType: 'exit_interview', sourceId: 'iv_1', ids: ['kb_1'] });
    expect(m.audit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      details: expect.objectContaining({ erasedEmbeddingIds: ['kb_1'], deactivatedKnowledgeBaseIds: ['kb_1'] }),
    }));
  });

  it('PATCH reclassification to a level that is never indexed takes the copy out of service even while consent stands', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true, knowledgeBaseId: 'kb_1' }]);
    m.updateReturningQueue.push(
      [{ id: 'iv_1', sensitivityLevel: 'legal_sensitive', consentGranted: true, knowledgeBaseId: 'kb_1' }],
      [{ id: 'kb_1' }],
    );
    m.erase.mockResolvedValue(['kb_1']);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-1', body: { sensitivityLevel: 'legal_sensitive' },
    });

    expect(response.status).toBe(200);
    const { knowledgeBase } = await import('@/db/schema');
    expect(m.updates).toHaveLength(2);
    expect(m.updates[0].set).not.toHaveProperty('consentGranted');
    expect(m.updates[1].table).toBe(knowledgeBase);
    expect(m.updates[1].set).toMatchObject({ isActive: false });
    expect(m.erase).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      details: expect.objectContaining({ newSensitivity: 'legal_sensitive', deactivatedKnowledgeBaseIds: ['kb_1'], erasedEmbeddingIds: ['kb_1'] }),
    }));
    expect((await response.json()).indexingEligible).toBe(false);
  });

  it('PATCH leaves the copy and its embedding alone when the interview stays indexable', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: true }]);
    m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);

    await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1', body: { sensitivityLevel: 'public_internal' },
    });

    expect(m.erase).not.toHaveBeenCalled();
  });

  it('a failure to erase the embedding fails the whole change (nothing is reported as withdrawn)', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);
    m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: false }], []);
    m.erase.mockRejectedValue(new Error('erase failed'));

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1', body: { consentGranted: false },
    });

    expect(response.status).toBe(500);
    expect(m.audit).not.toHaveBeenCalled();
  });

  // DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW: a single administrator must not be
  // able to lower a published interview out of legal_sensitive/executive_confidential unilaterally.
  describe('reclassification dual-approval (DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW)', () => {
    it('PATCH defers a downgrade from legal_sensitive to a pending request instead of applying it', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'legal_sensitive', consentGranted: true, updatedAt: new Date('2026-01-01T00:00:00Z') }]);
      m.insertReturningQueue.push([{ id: 'evt_req_1' }]);

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-a', body: { sensitivityLevel: 'public_internal' },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.pendingApproval).toBe(true);
      expect(json.pendingApprovalEventId).toBe('evt_req_1');
      expect(json.data.sensitivityLevel).toBe('legal_sensitive'); // unchanged
      // No row update happened - only the pending-request event was inserted.
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(m.inserted).toHaveLength(1);
      expect(m.inserted[0].values).toMatchObject({
        eventType: 'governance_updated',
        payload: expect.objectContaining({ kind: 'reclassification_requested', requestedLevel: 'public_internal', requestedBy: 'admin-a' }),
      });
      expect(m.audit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ action: 'exit_interview.governance_reclassification_requested' }));
    });

    it('PATCH does not require approval for a lateral move between the two most restrictive tiers', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'legal_sensitive', consentGranted: true, updatedAt: new Date() }]);
      m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'executive_confidential', consentGranted: true }]);

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-a', body: { sensitivityLevel: 'executive_confidential' },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.pendingApproval).toBeUndefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('PATCH approves a pending reclassification when a different admin submits approveReclassificationEventId', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push(
        [{ id: 'iv_1', sensitivityLevel: 'legal_sensitive', consentGranted: true, updatedAt: new Date() }],
        [{ id: 'evt_req_1', eventType: 'governance_updated', payload: { kind: 'reclassification_requested', requestedLevel: 'public_internal', previousLevel: 'legal_sensitive', requestedBy: 'admin-a', reason: null } }],
      );
      m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-b', body: { approveReclassificationEventId: 'evt_req_1' },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.sensitivityLevel).toBe('public_internal');
      expect(m.updates[0].set).toMatchObject({ sensitivityLevel: 'public_internal' });
      expect(m.audit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
        action: 'exit_interview.governance_reclassification_approved',
        details: expect.objectContaining({ requestedBy: 'admin-a' }),
      }));
    });

    it('PATCH refuses self-approval of a reclassification request', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push(
        [{ id: 'iv_1', sensitivityLevel: 'legal_sensitive', consentGranted: true, updatedAt: new Date() }],
        [{ id: 'evt_req_1', eventType: 'governance_updated', payload: { kind: 'reclassification_requested', requestedLevel: 'public_internal', previousLevel: 'legal_sensitive', requestedBy: 'admin-a', reason: null } }],
      );

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-a', body: { approveReclassificationEventId: 'evt_req_1' },
      });

      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('PATCH refuses to approve a stale request whose sensitivity level already changed', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push(
        [{ id: 'iv_1', sensitivityLevel: 'executive_confidential', consentGranted: true, updatedAt: new Date() }],
        [{ id: 'evt_req_1', eventType: 'governance_updated', payload: { kind: 'reclassification_requested', requestedLevel: 'public_internal', previousLevel: 'legal_sensitive', requestedBy: 'admin-a', reason: null } }],
      );

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-b', body: { approveReclassificationEventId: 'evt_req_1' },
      });

      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('PATCH returns 404 for an approval id that is not a pending reclassification request', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push(
        [{ id: 'iv_1', sensitivityLevel: 'legal_sensitive', consentGranted: true, updatedAt: new Date() }],
        [],
      );

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'admin-b', body: { approveReclassificationEventId: 'evt_missing' },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('optimistic concurrency (expectedUpdatedAt)', () => {
    it('PATCH rejects with 409 when expectedUpdatedAt does not match the current row', async () => {
      const { PATCH } = await loadRoute();
      m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: true, updatedAt: new Date('2026-01-01T00:00:00Z') }]);

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1',
        body: { sensitivityLevel: 'public_internal', expectedUpdatedAt: '2025-06-01T00:00:00.000Z' },
      });

      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('PATCH succeeds when expectedUpdatedAt matches the current row', async () => {
      const { PATCH } = await loadRoute();
      const updatedAt = new Date('2026-01-01T00:00:00Z');
      m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: true, updatedAt }]);
      m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);

      const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
        params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1',
        body: { sensitivityLevel: 'public_internal', expectedUpdatedAt: updatedAt.toISOString() },
      });

      expect(response.status).toBe(200);
    });
  });
});
