import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  getCached: vi.fn(),
  setCached: vi.fn(),
  embed: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  operation: vi.fn(),
  ready: vi.fn(),
  writeEmbedding: vi.fn(),
  eraseEmbeddings: vi.fn(async () => [] as string[]),
  where: [] as unknown[],
  set: [] as unknown[],
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['update', 'select', 'from', 'limit', 'insert', 'values', 'returning']) {
    c[m] = () => c;
  }
  c.where = (arg: unknown) => { h.where.push(arg); return c; };
  c.set = (arg: unknown) => { h.set.push(arg); return c; };
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
  toGatewayDataClass: (c: string) => c,
  UE_APP_KEY: 'ue', UE_SYSTEM_ORG_ID: 'sys', UE_PROFILES: { EMBEDDINGS: 'emb' },
}));
vi.mock('@/lib/services/ai/embedding-cache', () => ({
  embeddingCache: { getCachedEmbedding: h.getCached, setCachedEmbedding: h.setCached },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: h.error } }));
vi.mock('@/lib/ai/vector-readiness', () => ({
  KNOWLEDGE_BASE_EMBEDDING: { table: 'knowledge_base', column: 'embedding' },
  VectorSearchUnavailableError: class extends Error {
    constructor(target: { table: string; column: string }) {
      super(`Semantic search is not available: ${target.table}.${target.column} is not a pgvector column on this database.`);
    }
  },
  vectorColumnReady: h.ready,
}));
vi.mock('@/lib/ai/knowledge-base-embeddings', () => ({ writeKnowledgeBaseEmbedding: h.writeEmbedding, eraseKnowledgeBaseEmbeddings: h.eraseEmbeddings }));

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
  h.where.length = 0;
  h.set.length = 0;
  h.getCached.mockReset();
  h.setCached.mockReset().mockResolvedValue(undefined);
  h.embed.mockReset();
  h.error.mockReset();
  h.audit.mockReset().mockResolvedValue(undefined);
  h.operation.mockReset().mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
  h.ready.mockReset().mockResolvedValue(true);
  h.writeEmbedding.mockReset().mockResolvedValue(undefined);
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
    // The vector is written to the row inside the same transaction, after the row exists.
    expect(h.writeEmbedding).toHaveBeenCalledWith(tx, { id: 'kb1', organizationId: 'org-1', embedding: [0.1, 0.2] });
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
    expect(h.writeEmbedding).toHaveBeenCalledWith(tx, { id: 'kb-existing', organizationId: 'org-1', embedding: [0.5, 0.6] });
  });

  it('is unavailable, neither indexed nor failed, where the database has no vector column, and sends nothing to the AI provider', async () => {
    h.queue.push([interview()]);
    h.ready.mockResolvedValue(false);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: expect.stringContaining('not available'), unavailable: true });
    expect(h.operation).not.toHaveBeenCalled();
    expect(h.embed).not.toHaveBeenCalled();
    expect(h.writeEmbedding).not.toHaveBeenCalled();
    // The interview keeps its pending status: nothing was skipped, indexed or failed, so nothing is audited.
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('still skips a blocked or unconsented interview where the vector column is missing', async () => {
    h.queue.push([interview({ consentGranted: false })], undefined, []);
    h.ready.mockResolvedValue(false);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Retiree consent not granted' });
    expect(h.ready).not.toHaveBeenCalled();
  });

  it('records a failure, and no success, when the vector cannot be written', async () => {
    h.queue.push([interview()], [{ id: 'kb1' }], undefined);
    h.getCached.mockResolvedValue([0.1, 0.2]);
    h.writeEmbedding.mockRejectedValueOnce(new Error('different vector dimensions 1536 and 2'));
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Indexing failed', failed: true });
    expect(JSON.stringify(result)).not.toContain('dimensions');
    expect(h.audit).not.toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index' }), 'success');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.failed' }), 'failure');
  });

  it('returns not-found without writing or auditing when the interview is missing in the organization', async () => {
    h.queue.push([]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Interview not found' });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('skips blocked sensitivity levels and audits the skip', async () => {
    h.queue.push([interview({ sensitivityLevel: 'legal_sensitive' })], undefined, []);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result.indexed).toBe(false);
    expect((result as { reason: string }).reason).toContain('blocks indexing');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.skipped' }), 'success');
    expect(h.operation).not.toHaveBeenCalled();
  });

  it('skips when consent not granted and sends nothing to the AI provider', async () => {
    h.queue.push([interview({ consentGranted: false })], undefined, []);
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
    expect(result).toEqual({ indexed: false, reason: 'Indexing failed', failed: true });
    expect(JSON.stringify(result)).not.toContain('audit down');
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
    expect(result).toEqual({ indexed: false, reason: 'Indexing failed', failed: true });
    expect(JSON.stringify(result)).not.toContain('embed boom');
    expect(h.error).toHaveBeenCalled();
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.failed' }), 'failure');
  });

  const kbCopyPredicate = expect.arrayContaining([
    ['organizationId', 'org-1'], ['sourceType', 'exit_interview'], ['sourceId', 'i1'],
  ]);

  it('does not embed a privileged interview, even with consent, and deactivates its existing knowledge-base copy', async () => {
    h.queue.push([interview({ sensitivityLevel: 'privileged', knowledgeBaseId: 'kb1' })], undefined, [{ id: 'kb1' }]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: expect.stringContaining('blocks indexing') });
    expect(h.operation).not.toHaveBeenCalled();
    expect(h.embed).not.toHaveBeenCalled();
    expect(h.where).toContainEqual(kbCopyPredicate);
    expect(h.set).toContainEqual(expect.objectContaining({ isActive: false }));
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'exit_interview.index.skipped', details: expect.objectContaining({ deactivatedKnowledgeBaseIds: ['kb1'] }) }),
      'success',
    );
  });

  it('deactivates the existing knowledge-base copy when consent has been withdrawn', async () => {
    h.queue.push([interview({ consentGranted: false, knowledgeBaseId: 'kb1' })], undefined, [{ id: 'kb1' }]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Retiree consent not granted' });
    expect(h.where).toContainEqual(kbCopyPredicate);
    expect(h.set).toContainEqual(expect.objectContaining({ isActive: false }));
  });

  // DEF-0B7-EXC-CONSENT-WITHDRAWAL-AND-RECLASSIFICATION-WITHDRAW-NOTHING-DERIVED
  it('erases the embedding of the copy when the interview may no longer be indexed, and records which', async () => {
    h.queue.push([interview({ consentGranted: false, knowledgeBaseId: 'kb1' })], undefined, [{ id: 'kb1' }]);
    h.eraseEmbeddings.mockResolvedValueOnce(['kb1']);
    await indexExitInterview('i1', 'org-1', 'user-1');
    expect(h.eraseEmbeddings).toHaveBeenCalledWith(tx, { organizationId: 'org-1', sourceType: 'exit_interview', sourceId: 'i1' });
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'exit_interview.index.skipped', details: expect.objectContaining({ erasedEmbeddingIds: ['kb1'] }) }),
      'success',
    );
  });

  it('requires consent and an indexable level where the index is written, and records no success when a withdrawal won', async () => {
    // The interview was consented when read; by the final write the conditional update matches nothing.
    h.queue.push([interview()], [{ id: 'kb1' }], []);
    h.getCached.mockResolvedValue([0.1, 0.2]);
    const result = await indexExitInterview('i1', 'org-1', 'user-1');
    expect(result).toEqual({ indexed: false, reason: 'Indexing failed', failed: true });
    expect(h.where).toContainEqual(expect.arrayContaining([
      ['status', 'published'], ['consentGranted', true], ['sensitivityLevel', ['public_internal', 'restricted']],
    ]));
    expect(h.audit).not.toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index' }), 'success');
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'exit_interview.index.failed' }), 'failure');
  });
});
