import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  selectQueue: [] as unknown[][],
  insertReturningQueue: [] as unknown[][],
  updateReturningQueue: [] as unknown[][],
  extractExpertise: vi.fn(),
  flattenExpertiseTags: vi.fn(),
  isIndexingAllowed: vi.fn(),
  indexExitInterview: vi.fn(),
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
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => (m.insertReturningQueue.shift() ?? [{ id: 'kb_1' }]) as unknown[]),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateReturningQueue.shift() ?? [{ id: 'iv_1', status: 'published' }]) as unknown[]),
      })),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
  },
}));

vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/knowledge-transfer/indexing/semantic-indexer', () => ({ indexExitInterview: m.indexExitInterview }));
vi.mock('@/lib/knowledge-transfer/expertise/expertise-extractor', () => ({
  extractExpertise: m.extractExpertise,
  flattenExpertiseTags: m.flattenExpertiseTags,
}));
vi.mock('@/lib/knowledge-transfer/governance/consent-controls', () => ({
  isIndexingAllowed: m.isIndexingAllowed,
}));

async function loadRoute() {
  return import('../exit-interviews/[id]/publish/route');
}

describe('exit-interviews/[id]/publish route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.insertReturningQueue = [];
    m.updateReturningQueue = [];
    m.extractExpertise.mockResolvedValue({
      continuitySensitivity: 'medium',
      undocumentedWorkflows: ['workflow-a'],
    });
    m.flattenExpertiseTags.mockReturnValue(['tag-a']);
    m.isIndexingAllowed.mockReturnValue(true);
    m.indexExitInterview.mockResolvedValue(undefined);

    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (_request: NextRequest, ctx: any = { params: { id: 'iv_1' }, organizationId: 'org_1', userId: 'u1' }) => {
          try {
            const data = await handler(ctx);
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), { status: err.status ?? 500 });
          }
        },
    );
  });

  it('returns 404 when interview does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/exit-interviews/iv_1/publish'), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(response.status).toBe(404);
  });

  it('returns alreadyPublished when status is published', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', status: 'published' }]);

    const response = await POST(new NextRequest('http://localhost/api/exit-interviews/iv_1/publish'), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.alreadyPublished).toBe(true);
  });

  it('returns 409 when status is not publishable', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'iv_1', status: 'draft' }]);

    const response = await POST(new NextRequest('http://localhost/api/exit-interviews/iv_1/publish'), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(response.status).toBe(409);
  });

  it('publishes interview and returns knowledge asset payload', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([
      {
        id: 'iv_1',
        status: 'submitted',
        title: 'Interview',
        retiringEmployeeName: 'Jane',
        roleInUnion: 'Steward',
        yearsOfService: 12,
        keyLessons: 'Document process',
        bestPractices: null,
        bargainingAdvice: null,
        mediationAdvice: null,
        incomingOfficerAdvice: null,
        summary: 'Summary',
        topics: ['topic-a'],
        reviewedAt: null,
        reviewedBy: null,
        sensitivityLevel: 'public_internal',
        consentGranted: true,
      },
    ]);
    m.insertReturningQueue.push([{ id: 'kb_1' }]);
    m.updateReturningQueue.push([{ id: 'iv_1', status: 'published', knowledgeBaseId: 'kb_1' }]);

    const response = await POST(new NextRequest('http://localhost/api/exit-interviews/iv_1/publish'), {
      params: { id: 'iv_1' },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe('published');
    expect(json.knowledgeAsset.id).toBe('kb_1');
  });
});
