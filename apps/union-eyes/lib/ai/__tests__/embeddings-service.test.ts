import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbed = vi.fn();
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: vi.fn(() => ({ embed: mockEmbed })),
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
  UE_APP_KEY: 'union-eyes',
  UE_PROFILES: { EMBEDDINGS: 'ue-embeddings' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { EmbeddingsService, createEmbeddingsService, embeddingsService } from '../embeddings-service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  const fakeVector = Array.from({ length: 1536 }, (_, i) => Math.sin(i));

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmbeddingsService();
    mockEmbed.mockResolvedValue({ embeddings: [fakeVector] });
  });

  describe('initialize', () => {
    it('initializes without error', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('is idempotent', async () => {
      await service.initialize();
      await service.initialize();
      // no error
    });
  });

  describe('embed', () => {
    it('returns an embedding with vector', async () => {
      const result = await service.embed('test text');
      expect(result.text).toBe('test text');
      expect(result.vector).toHaveLength(1536);
      expect(result.id).toBeDefined();
    });

    it('auto-initializes if not initialized', async () => {
      const result = await service.embed('auto init');
      expect(result.vector).toBeDefined();
    });
  });

  describe('embedBatch', () => {
    it('returns embeddings for multiple texts', async () => {
      mockEmbed.mockResolvedValue({ embeddings: [fakeVector, fakeVector] });
      const results = await service.embedBatch(['text1', 'text2']);
      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('text1');
      expect(results[1].text).toBe('text2');
    });
  });

  describe('search', () => {
    it('returns results sorted by similarity', async () => {
      const v1 = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
      const v2 = Array.from({ length: 1536 }, (_, i) => Math.cos(i));
      const candidates = [
        { id: 'a', text: 'similar', vector: v1, metadata: {} },
        { id: 'b', text: 'different', vector: v2, metadata: {} },
      ];
      mockEmbed.mockResolvedValue({ embeddings: [v1] });
      const results = await service.search('query', candidates, 2);
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    it('respects topK limit', async () => {
      const v = Array.from({ length: 1536 }, () => 0.5);
      const candidates = Array.from({ length: 10 }, (_, i) => ({
        id: `e${i}`, text: `text ${i}`, vector: v, metadata: {},
      }));
      mockEmbed.mockResolvedValue({ embeddings: [v] });
      const results = await service.search('query', candidates, 3);
      expect(results).toHaveLength(3);
    });
  });

  describe('getInfo', () => {
    it('returns config with initialization state', () => {
      const info = service.getInfo();
      expect(info.dimensions).toBe(1536);
      expect(info.batchSize).toBe(100);
      expect(info.isInitialized).toBe(false);
    });
  });
});

describe('createEmbeddingsService', () => {
  it('creates a new service instance', () => {
    const svc = createEmbeddingsService({ dimensions: 768 });
    expect(svc.getInfo().dimensions).toBe(768);
  });
});

describe('embeddingsService', () => {
  it('is a singleton instance', () => {
    expect(embeddingsService).toBeInstanceOf(EmbeddingsService);
  });
});
