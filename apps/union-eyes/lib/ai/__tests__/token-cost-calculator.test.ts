import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  estimateTokens,
  estimateCostForText,
  getModelPricing,
  getAllModelPricing,
  compareCosts,
  getCheapestModel,
  MODEL_PRICING,
} from '../services/token-cost-calculator';

describe('TokenCostCalculator', () => {
  // ────────────────────────────────────────────────────────────────
  // calculateCost
  // ────────────────────────────────────────────────────────────────
  describe('calculateCost', () => {
    it('calculates GPT-4 Turbo cost correctly', () => {
      // $10/M input + $30/M output → 1000 input + 500 output
      const cost = calculateCost('gpt-4-turbo', 1000, 500);
      const expected = (1000 / 1_000_000) * 10 + (500 / 1_000_000) * 30;
      expect(cost).toBeCloseTo(expected, 10);
    });

    it('calculates GPT-3.5 Turbo cost correctly', () => {
      const cost = calculateCost('gpt-3.5-turbo', 10000, 5000);
      const expected = (10000 / 1_000_000) * 0.5 + (5000 / 1_000_000) * 1.5;
      expect(cost).toBeCloseTo(expected, 10);
    });

    it('calculates Claude 3 Opus cost', () => {
      const cost = calculateCost('claude-3-opus-20240229', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(15 + 75, 6);
    });

    it('calculates zero cost for embedding models (output)', () => {
      const cost = calculateCost('text-embedding-ada-002', 1_000_000, 0);
      expect(cost).toBeCloseTo(0.1, 6);
    });

    it('returns 0 for unknown model', () => {
      const cost = calculateCost('nonexistent-model', 1000, 500);
      expect(cost).toBe(0);
    });

    it('returns 0 for zero tokens', () => {
      const cost = calculateCost('gpt-4-turbo', 0, 0);
      expect(cost).toBe(0);
    });

    it('is always non-negative', () => {
      for (const model of Object.keys(MODEL_PRICING)) {
        const cost = calculateCost(model, 1000, 1000);
        expect(cost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // estimateTokens
  // ────────────────────────────────────────────────────────────────
  describe('estimateTokens', () => {
    it('estimates ~1 token per 4 chars', () => {
      const tokens = estimateTokens('hello world!!!!!!!!'); // 19 chars → ceil(19/4) = 5
      expect(tokens).toBe(Math.ceil(19 / 4));
    });

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('returns 0 for undefined-ish input', () => {
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it('handles long text', () => {
      const text = 'a'.repeat(10_000);
      expect(estimateTokens(text)).toBe(2500);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // estimateCostForText
  // ────────────────────────────────────────────────────────────────
  describe('estimateCostForText', () => {
    it('estimates cost for a short prompt', () => {
      const cost = estimateCostForText('Hello, how are you?', 'gpt-3.5-turbo');
      expect(cost).toBeGreaterThan(0);
    });

    it('uses output ratio to estimate output tokens', () => {
      const text = 'a'.repeat(4000); // ~1000 input tokens
      const cost1x = estimateCostForText(text, 'gpt-4-turbo', 1.0);
      const cost2x = estimateCostForText(text, 'gpt-4-turbo', 2.0);
      expect(cost2x).toBeGreaterThan(cost1x);
    });

    it('returns 0 for unknown model', () => {
      expect(estimateCostForText('test', 'unknown-model')).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getModelPricing
  // ────────────────────────────────────────────────────────────────
  describe('getModelPricing', () => {
    it('returns pricing for known model', () => {
      const pricing = getModelPricing('gpt-4-turbo');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(10);
      expect(pricing!.outputPerMillion).toBe(30);
    });

    it('returns null for unknown model', () => {
      expect(getModelPricing('unknown-model')).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getAllModelPricing
  // ────────────────────────────────────────────────────────────────
  describe('getAllModelPricing', () => {
    it('returns all registered models', () => {
      const all = getAllModelPricing();
      expect(all.length).toBe(Object.keys(MODEL_PRICING).length);
    });

    it('classifies providers correctly', () => {
      const all = getAllModelPricing();
      const providers = new Set(all.map(m => m.provider));
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).toContain('azure');
    });

    it('each entry has valid pricing', () => {
      for (const entry of getAllModelPricing()) {
        expect(entry.pricing.inputPerMillion).toBeGreaterThanOrEqual(0);
        expect(entry.pricing.outputPerMillion).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // compareCosts
  // ────────────────────────────────────────────────────────────────
  describe('compareCosts', () => {
    it('sorts cheapest first', () => {
      const comparison = compareCosts(
        ['gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku-20240307'],
        10000,
        5000
      );
      expect(comparison).toHaveLength(3);
      expect(comparison[0].cost).toBeLessThanOrEqual(comparison[1].cost);
      expect(comparison[1].cost).toBeLessThanOrEqual(comparison[2].cost);
    });

    it('includes formatted costPerRequest', () => {
      const comparison = compareCosts(['gpt-3.5-turbo'], 1000, 500);
      expect(comparison[0].costPerRequest).toMatch(/^\$/);
    });

    it('handles unknown model in list', () => {
      const comparison = compareCosts(['unknown', 'gpt-3.5-turbo'], 1000, 500);
      // unknown has cost=0, so should be first
      expect(comparison[0].model).toBe('unknown');
      expect(comparison[0].cost).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getCheapestModel
  // ────────────────────────────────────────────────────────────────
  describe('getCheapestModel', () => {
    it('finds cheapest completion model', () => {
      const result = getCheapestModel(10000, 5000, 'completion');
      expect(result).not.toBeNull();
      // Claude Haiku or GPT-3.5 should be cheapest
      expect(result!.cost).toBeGreaterThan(0);
    });

    it('finds cheapest embedding model', () => {
      const result = getCheapestModel(10000, 0, 'embedding');
      expect(result).not.toBeNull();
      expect(result!.model).toContain('embedding');
    });

    it('embedding models are cheaper than completion models for same tokens', () => {
      const embedding = getCheapestModel(100000, 0, 'embedding')!;
      const completion = getCheapestModel(100000, 100000, 'completion')!;
      expect(embedding.cost).toBeLessThan(completion.cost);
    });
  });
});
