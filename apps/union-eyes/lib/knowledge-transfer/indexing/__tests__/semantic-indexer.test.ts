import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  getCached: vi.fn(),
  setCached: vi.fn(),
  embed: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  operation: vi.fn(),
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

const tx = chain();
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: h.operation }));
vi.mock('@/db/schema', () => ({
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
  exitInterviewEvents: new Proxy({}, { get: (_t, p) => String(p) }),
  knowledgeBase: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a, inArray: (...a: unknown[]) => a }));
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
  h.audit.mockReset().mockResolvedValue(undefined);
  h.operation.mockReset().mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
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

  it('indexes a new interview with a cached embedding and audits on the same transaction', async () => {
    h.queue.push([interview()], [{ id: 'kb1' }], [{ id: 'i1' }]);
    h.getCached.mockResolvedValue([0.1, 0.2]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: true, knowledgeBaseId: 'kb1' });
    expect(h.embed).not.toHaveBeenCalled();
    expect(h.operation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'exit_interview.index.embed' }),
      expect.any(Function),
    );
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'exit_interview.index', resourceId: 'i1' }),
      'success',
    );
  });

  it('upserts an existing kb record and generates embedding via AI', async () => {
    h.queue.push([interview({ knowledgeBaseId: 'kb-existing' })], [{ id: 'kb-existing' }], [{ id: 'i1' }]);
    h.getCached.mockResolvedValue(null);
    h.embed.mockResolvedValue({ embeddings: [[0.5, 0.6]] });
    h.setCached.mockRejectedValue(new Error('cache write failed'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: true, knowledgeBaseId: 'kb-existing' });
    expect(h.embed).toHaveBeenCalled();
    expect(h.setCached).toHaveBeenCalled();
  });

  it('returns not-found without writing or auditing when the interview is missing in the organization', async () => {
    h.queue.push([]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Interview not found' });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('skips blocked sensitivity levels and audits the skip', async () => {
    h.queue.push([interview({ sensitivityLevel: 'legal_sensitive' })], undefined);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect((result as { reason: string }).reason).toContain('blocks indexing');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.skipped' }), 'success');
    expect(h.operation).not.toHaveBeenCalled();
  });

  it('does not embed privileged content despite an old generic consent flag', async () => {
    h.queue.push([interview({ sensitivityLevel: 'privileged', consentGranted: true })], undefined);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect(h.operation).not.toHaveBeenCalled();
    expect(h.embed).not.toHaveBeenCalled();
  });

  it('enforces the latest consent and sensitivity again at the final database commit', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../semantic-indexer.ts'), 'utf8');
    const mutation = src.slice(src.indexOf('const [marked] = await tx'), src.indexOf('if (!marked)'));
    expect(mutation).toContain('eq(exitInterviews.consentGranted, true)');
    expect(mutation).toContain("inArray(exitInterviews.sensitivityLevel, ['public_internal', 'restricted'])");
    expect(src).toContain("eq(knowledgeBase.sourceId, interviewId)");
  });

  it('skips when consent not granted and sends nothing to the AI provider', async () => {
    h.queue.push([interview({ consentGranted: false })], undefined);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Retiree consent not granted' });
    expect(h.operation).not.toHaveBeenCalled();
    expect(h.embed).not.toHaveBeenCalled();
  });

  it('does not call the AI provider when the operation intent cannot be recorded', async () => {
    h.queue.push([interview()], undefined);
    h.operation.mockRejectedValueOnce(new Error('intent not recorded'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect(h.embed).not.toHaveBeenCalled();
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.failed' }), 'failure');
  });

  it('does not report success when the audit record of the index cannot be written', async () => {
    h.queue.push([interview()], [{ id: 'kb1' }], [{ id: 'i1' }], undefined);
    h.getCached.mockResolvedValue([0.1]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect((result as { reason: string }).reason).toContain('audit down');
  });

  it('records the requested event in the same transaction as the index', async () => {
    h.queue.push([interview()], [{ id: 'kb1' }], [{ id: 'i1' }], undefined);
    h.getCached.mockResolvedValue([0.1]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1', { eventNotes: 'Manual re-index' });
    expect(result).toEqual({ indexed: true, knowledgeBaseId: 'kb1' });
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index' }), 'success');
  });

  it('handles errors and marks indexing failed', async () => {
    h.queue.push([interview()], undefined);
    h.getCached.mockRejectedValue(new Error('embed boom'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect((result as { reason: string }).reason).toContain('embed boom');
    expect(h.error).toHaveBeenCalled();
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.failed' }), 'failure');
  });
});
