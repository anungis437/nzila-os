import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  logger: { info: vi.fn(), error: vi.fn() },
  extractPersistedAdaptiveReportAISlot: vi.fn(),
  resolveAdaptiveReportAISlot: vi.fn(),
  applyAdaptiveReportReviewDecision: vi.fn(),
  embedPersistedAdaptiveReportAISlot: vi.fn(),
  selectQueue: [] as unknown[][],
  updateThrow: false,
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => {
        if (m.updateThrow) throw new Error('db fail');
      }),
    })),
  })),
};

vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/icra/questions', () => ({ ALL_QUESTIONS: [] }));
vi.mock('@/lib/icra/adaptation', () => ({
  extractPersistedAdaptiveReportAISlot: m.extractPersistedAdaptiveReportAISlot,
  resolveAdaptiveReportAISlot: m.resolveAdaptiveReportAISlot,
  applyAdaptiveReportReviewDecision: m.applyAdaptiveReportReviewDecision,
  embedPersistedAdaptiveReportAISlot: m.embedPersistedAdaptiveReportAISlot,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../icra/report/[assessmentId]/review/route');
}

describe('icra/report/[assessmentId]/review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateThrow = false;
    process.env.CRON_SECRET_KEY = 'secret';
    m.extractPersistedAdaptiveReportAISlot.mockReturnValue(null);
    m.resolveAdaptiveReportAISlot.mockReturnValue({ reviewWorkflow: { status: 'pending' } });
    m.applyAdaptiveReportReviewDecision.mockReturnValue({ reviewWorkflow: { status: 'approved' } });
    m.embedPersistedAdaptiveReportAISlot.mockReturnValue({ ai: 'slot' });
  });

  it('returns 400 for invalid assessment id', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/report/bad/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'secret' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: 'bad' }) });

    expect(response.status).toBe(400);
  });

  it('returns 401 for invalid secret', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'wrong' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid action', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'secret' }, body: JSON.stringify({ action: 'noop', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when assessment is missing', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'secret' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(404);
  });

  it('returns 422 when AI slot cannot be resolved', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA' }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);
    m.resolveAdaptiveReportAISlot.mockReturnValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'secret' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(422);
  });

  it('records review decision successfully', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA' }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);

    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'secret' }, body: JSON.stringify({ action: 'approve', summary: 'approved by governance' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.reviewStatus).toBe('approved');
  });
});
