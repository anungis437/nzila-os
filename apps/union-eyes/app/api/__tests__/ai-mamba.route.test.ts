import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  mambaModel: {
    process: vi.fn(),
    processLongDocument: vi.fn(),
    getInfo: vi.fn(),
  },
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_MAMBA: 'AI_MAMBA' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/mamba-service', () => ({ mambaModel: m.mambaModel }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/mamba/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/ai/mamba', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('ai/mamba route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'officer';

    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);

    m.mambaModel.process.mockResolvedValue({ text: 'summary', processingTime: 12 });
    m.mambaModel.processLongDocument.mockResolvedValue({ chunks: 3, processingTime: 45 });
    m.mambaModel.getInfo.mockReturnValue({ maxSequenceLength: 65536 });
  });

  it('declares what it asks of the wrapper: an officer on both handlers, and the advanced-insights entitlement for processing text', async () => {
    await loadRoute();
    const processing = declared.find((entry) => entry.openapi?.summary === 'Process text with the Mamba model');
    const info = declared.find((entry) => entry.openapi?.summary === 'Mamba model information');

    expect(processing?.auth).toEqual({ minRole: 'officer' });
    expect(processing?.entitlement).toBe('ai_advanced_insights');
    expect(info?.auth).toEqual({ minRole: 'officer' });
    expect(info?.entitlement).toBeUndefined();
  });

  it('refuses a steward on both handlers before any limit, feature or model is touched', async () => {
    caller.role = 'steward';
    const { POST, GET } = await loadRoute();

    expect((await POST(post({ input: 'Hello world' }))).status).toBe(403);
    expect((await GET(new NextRequest('http://localhost/api/ai/mamba'))).status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.mambaModel.process).not.toHaveBeenCalled();
    expect(m.mambaModel.getInfo).not.toHaveBeenCalled();
  });

  it('returns validation error for empty input', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ input: '' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Validation failed' });
    expect(m.mambaModel.process).not.toHaveBeenCalled();
    expect(m.mambaModel.processLongDocument).not.toHaveBeenCalled();
  });

  it('processes standard request', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ input: 'Hello world', options: { maxTokens: 128 } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, result: { text: 'summary', processingTime: 12 } });
    expect(m.mambaModel.process).toHaveBeenCalledWith('Hello world', expect.objectContaining({ maxTokens: 128 }));
    expect(m.mambaModel.processLongDocument).not.toHaveBeenCalled();
  });

  it('routes a long document to the long-document processor', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ input: 'Hello world', options: { longDocument: true } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, result: { chunks: 3, processingTime: 45 } });
    expect(m.mambaModel.processLongDocument).toHaveBeenCalledWith('Hello world');
    expect(m.mambaModel.process).not.toHaveBeenCalled();
  });

  it('returns model info from GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/ai/mamba'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ model: 'mamba-ssm', capabilities: { maxSequenceLength: 65536 } });
  });
});
