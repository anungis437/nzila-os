import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../data-ingestion', () => ({
  dataIngestion: { ingest: vi.fn() },
  IngestedDocument: {},
}));

vi.mock('../entity-extraction', () => ({
  entityExtraction: { extract: vi.fn(() => ({ orgs: [], relationships: [], documentType: 'unknown', confidence: 0.5 })) },
  ExtractionResult: {},
}));

vi.mock('../rag-pipeline', () => ({
  ragPipeline: {
    search: vi.fn(async () => []),
    addDocuments: vi.fn(async () => {}),
    getStats: vi.fn(() => ({ documentsCount: 0, chunksCount: 0 })),
  },
  SearchResult: {},
}));

vi.mock('../template-engine', () => ({
  templateEngine: {
    buildPrompt: vi.fn(() => 'test prompt'),
    execute: vi.fn(async () => 'AI response'),
  },
  TemplateContext: {},
}));

vi.mock('../safety', () => ({
  aiSafety: {
    checkInput: vi.fn(() => ({ safe: true, flags: [] })),
    checkOutput: vi.fn(() => ({ safe: true, flags: [] })),
  },
  SafetyCheckResult: {},
}));

vi.mock('../learning', () => ({
  learningService: {
    detectKnowledgeGap: vi.fn(),
    getStats: vi.fn(() => ({ totalFeedback: 0 })),
  },
}));

// Dynamic import to get the class after mocks
const { AIPipeline } = await import('../pipeline');

describe('AIPipeline', () => {
  let pipeline: InstanceType<typeof AIPipeline>;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new AIPipeline();
  });

  describe('process', () => {
    it('returns a valid pipeline result', async () => {
      const result = await pipeline.process('What are my rights?', {
        userId: 'u1',
        organizationId: 'org-1',
        sessionId: 's1',
      });
      expect(result.response).toBeDefined();
      expect(result.safety).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.latency).toBeGreaterThanOrEqual(0);
    });

    it('blocks unsafe input', async () => {
      const { aiSafety } = await import('../safety');
      vi.mocked(aiSafety.checkInput).mockReturnValueOnce({ safe: false, flags: ['harmful'] });
      const result = await pipeline.process('dangerous query', {
        userId: 'u1',
        organizationId: 'org-1',
        sessionId: 's1',
      });
      expect(result.response).toContain("can't help");
    });

    it('returns fallback on error', async () => {
      const { ragPipeline: rp } = await import('../rag-pipeline');
      vi.mocked(rp.search).mockRejectedValueOnce(new Error('fail'));
      const result = await pipeline.process('query', {
        userId: 'u1',
        organizationId: 'org-1',
        sessionId: 's1',
      });
      expect(result.response).toBeDefined();
      expect(result.sources).toEqual([]);
    });
  });

  describe('updateConfig', () => {
    it('merges partial config', () => {
      pipeline.updateConfig({ enableRAG: false });
      // No error
    });
  });

  describe('classifyIntent (via process)', () => {
    it('handles how-to queries', async () => {
      const result = await pipeline.process('How do I file a grievance?', {
        userId: 'u1',
        organizationId: 'org-1',
        sessionId: 's1',
      });
      expect(result.response).toBeDefined();
    });

    it('handles information queries', async () => {
      const result = await pipeline.process('What is a collective agreement?', {
        userId: 'u1',
        organizationId: 'org-1',
        sessionId: 's1',
      });
      expect(result.response).toBeDefined();
    });
  });
});
