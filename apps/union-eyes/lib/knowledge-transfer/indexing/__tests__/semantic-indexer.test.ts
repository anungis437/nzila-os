import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  getCached: vi.fn(),
  setCached: vi.fn(),
  embed: vi.fn(),
  error: vi.fn(),
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['update', 'set', 'where', 'select', 'from', 'limit', 'insert', 'values', 'returning']) {
    c[m] = () => c;
  }
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  c.catch = (cb: () => void) => { cb?.(); return c; };
  return c;
}

vi.mock('@/db/db', () => ({ db: chain() }));
vi.mock('@/db/schema', () => ({
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
  knowledgeBase: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ embed: h.embed }),
  UE_APP_KEY: 'ue', UE_SYSTEM_ORG_ID: 'sys', UE_PROFILES: { EMBEDDINGS: 'emb' },
}));
vi.mock('@/lib/services/ai/embedding-cache', () => ({
  embeddingCache: { getCachedEmbedding: h.getCached, setCachedEmbedding: h.setCached },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: h.error } }));

import { buildIndexableContent, indexExitInterview } from '../semantic-indexer';

function interview(extra: Record<string, unknown> = {}) {
  return {
    id: 'i1', title: 'Exit', roleInUnion: 'steward', yearsOfService: 5,
    summary: 'sum', keyLessons: 'kl', bestPractices: 'bp', bargainingAdvice: 'ba',
    mediationAdvice: 'ma', incomingOfficerAdvice: 'ioa', expertiseTags: ['WSIB'], topics: ['safety'],
    sensitivityLevel: 'public_internal', consentGranted: true, knowledgeBaseId: null,
    ...extra,
  };
}

beforeEach(() => {
  h.queue.length = 0;
  h.getCached.mockReset();
  h.setCached.mockReset().mockResolvedValue(undefined);
  h.embed.mockReset();
  h.error.mockReset();
});

describe('lib/knowledge-transfer/indexing/semantic-indexer', () => {
  it('buildIndexableContent includes all populated sections', () => {
    const content = buildIndexableContent(interview() as never);
    expect(content).toContain('# Exit');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Best practices');
    expect(content).toContain('## Expertise areas');
    expect(content).toContain('## Topics');
  });

  it('buildIndexableContent omits empty sections', () => {
    const content = buildIndexableContent(interview({ summary: null, keyLessons: null, bestPractices: null, bargainingAdvice: null, mediationAdvice: null, incomingOfficerAdvice: null, expertiseTags: [], topics: [] }) as never);
    expect(content).not.toContain('## Summary');
    expect(content).not.toContain('## Topics');
  });

  it('indexes a new interview with a cached embedding', async () => {
    h.queue.push(undefined, [interview()], [{ id: 'kb1' }], undefined);
    h.getCached.mockResolvedValue([0.1, 0.2]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: true, knowledgeBaseId: 'kb1' });
    expect(h.embed).not.toHaveBeenCalled();
  });

  it('upserts an existing kb record and generates embedding via AI', async () => {
    h.queue.push(undefined, [interview({ knowledgeBaseId: 'kb-existing' })], undefined, undefined);
    h.getCached.mockResolvedValue(null);
    h.embed.mockResolvedValue({ embeddings: [[0.5, 0.6]] });
    h.setCached.mockRejectedValue(new Error('cache write failed'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: true, knowledgeBaseId: 'kb-existing' });
    expect(h.embed).toHaveBeenCalled();
    expect(h.setCached).toHaveBeenCalled();
  });

  it('returns not-found when interview missing', async () => {
    h.queue.push(undefined, []);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Interview not found' });
  });

  it('skips blocked sensitivity levels', async () => {
    h.queue.push(undefined, [interview({ sensitivityLevel: 'legal_sensitive' })], undefined);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect((result as { reason: string }).reason).toContain('blocks indexing');
  });

  it('skips when consent not granted', async () => {
    h.queue.push(undefined, [interview({ consentGranted: false })], undefined);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Retiree consent not granted' });
  });

  it('handles errors and marks indexing failed', async () => {
    h.queue.push(undefined, [interview()], undefined);
    h.getCached.mockRejectedValue(new Error('embed boom'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect((result as { reason: string }).reason).toContain('embed boom');
    expect(h.error).toHaveBeenCalled();
  });
});
