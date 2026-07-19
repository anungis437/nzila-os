import { describe, expect, it, vi } from 'vitest';

vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));

import {
  calculateCost,
  compareCosts,
  estimateCostForText,
  estimateTokens,
  getAllModelPricing,
  getCheapestModel,
  getModelPricing,
} from '../token-cost-calculator';

describe('lib/ai/services/token-cost-calculator', () => {
  describe('calculateCost', () => {
    it('computes input + output cost for a known model', () => {
      expect(calculateCost('gpt-4', 1_000_000, 1_000_000)).toBeCloseTo(90, 5);
    });
    it('returns 0 for an unknown model', () => {
      expect(calculateCost('does-not-exist', 1000, 1000)).toBe(0);
    });
  });

  describe('estimateTokens', () => {
    it('returns 0 for empty and ~length/4 otherwise', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcde')).toBe(2);
    });
  });

  describe('estimateCostForText', () => {
    it('estimates a non-negative cost', () => {
      const cost = estimateCostForText('hello world', 'gpt-3.5-turbo', 2);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getModelPricing', () => {
    it('returns pricing or null', () => {
      expect(getModelPricing('gpt-4')).toEqual({ inputPerMillion: 30, outputPerMillion: 60 });
      expect(getModelPricing('nope')).toBeNull();
    });
  });

  describe('getAllModelPricing', () => {
    it('labels providers correctly', () => {
      const all = getAllModelPricing();
      const byModel = Object.fromEntries(all.map((m) => [m.model, m.provider]));
      expect(byModel['gpt-4']).toBe('openai');
      expect(byModel['claude-3-opus-20240229']).toBe('anthropic');
      expect(byModel['gemini-1.5-pro']).toBe('google');
      expect(byModel['azure-gpt-4']).toBe('azure');
    });
  });

  describe('compareCosts', () => {
    it('returns costs sorted ascending', () => {
      const rows = compareCosts(['gpt-4', 'gpt-3.5-turbo'], 1000, 1000);
      expect(rows[0].cost).toBeLessThanOrEqual(rows[1].cost);
      expect(rows[0].costPerRequest).toMatch(/^\$/);
    });
  });

  describe('getCheapestModel', () => {
    it('finds the cheapest completion model', () => {
      const r = getCheapestModel(1000, 1000, 'completion');
      expect(r).not.toBeNull();
      expect(r!.model).not.toContain('embedding');
    });
    it('finds the cheapest embedding model', () => {
      const r = getCheapestModel(1000, 0, 'embedding');
      expect(r!.model).toContain('embedding');
    });
  });
});
