import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { MambaModel } from '../mamba-service';

describe('MambaModel', () => {
  let model: MambaModel;

  beforeEach(() => {
    model = new MambaModel();
  });

  describe('initialize', () => {
    it('initializes without error', async () => {
      await expect(model.initialize()).resolves.not.toThrow();
    });

    it('does not re-initialize', async () => {
      await model.initialize();
      // Second call should be a no-op
      await expect(model.initialize()).resolves.not.toThrow();
    });
  });

  describe('process', () => {
    it('processes claim-related input', async () => {
      const result = await model.process('I need help with a claim');
      expect(result.output).toContain('claim');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('mamba-ssm');
      expect(result.metadata.device).toBe('cpu');
    });

    it('processes member-related input', async () => {
      const result = await model.process('Tell me about this member');
      expect(result.output).toContain('member');
    });

    it('processes contract-related input', async () => {
      const result = await model.process('Explain the CBA terms');
      expect(result.output.length).toBeGreaterThan(10);
    });

    it('handles generic input', async () => {
      const result = await model.process('hello world');
      expect(result.output.length).toBeGreaterThan(0);
    });

    it('accepts system prompt option', async () => {
      const result = await model.process('test input', {
        systemPrompt: 'You are a helpful assistant',
      });
      expect(result.output.length).toBeGreaterThan(0);
    });

    it('auto-initializes if not initialized', async () => {
      // Don't call initialize() first
      const result = await model.process('test');
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('processLongDocument', () => {
    it('chunks and processes long documents', async () => {
      const longDoc = 'This is a test document about claims. '.repeat(200);
      const result = await model.processLongDocument(longDoc, 500, 50);
      expect(result.output.length).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('handles small documents without chunking overhead', async () => {
      const shortDoc = 'Short document.';
      const result = await model.processLongDocument(shortDoc);
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('custom config', () => {
    it('accepts custom configuration', () => {
      const custom = new MambaModel({
        device: 'cuda',
        maxSequenceLength: 16384,
        temperature: 0.5,
      });
      expect(custom).toBeInstanceOf(MambaModel);
    });
  });
});
