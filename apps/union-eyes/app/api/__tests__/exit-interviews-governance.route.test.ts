import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: {
    badRequest: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 400 })),
    notFound: vi.fn((msg: string) => Object.assign(new Error(msg), { status: 404 })),
  },
  selectQueue: [] as unknown[][],
  updateReturningQueue: [] as unknown[][],
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
  update: vi.fn(() => ({
    set: vi.fn(() => ({
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
    and: vi.fn(() => 'and'),
    eq: vi.fn(() => 'eq'),
  };
});

async function loadRoute() {
  return import('../exit-interviews/[id]/governance/route');
}

describe('exit-interviews/[id]/governance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateReturningQueue = [];
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

  it('PATCH updates sensitivity and consent flags', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', sensitivityLevel: 'restricted', consentGranted: false }]);
    m.updateReturningQueue.push([{ id: 'iv_1', sensitivityLevel: 'public_internal', consentGranted: true }]);

    const response = await PATCH(new NextRequest('http://localhost/api/exit-interviews/iv_1/governance', { method: 'PATCH' }), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
      body: { sensitivityLevel: 'public_internal', consentGranted: true, consentNotes: 'consent on file' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.sensitivityLevel).toBe('public_internal');
    expect(json.data.consentGranted).toBe(true);
    expect(json.indexingEligible).toBe(true);
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
