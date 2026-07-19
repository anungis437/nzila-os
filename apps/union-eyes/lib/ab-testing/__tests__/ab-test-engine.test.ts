import { describe, expect, it, vi } from 'vitest';

const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info, warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  assignVariant,
  calculateChiSquare,
  completeTest,
  createABTest,
  createTestFromTemplate,
  determineWinner,
  pauseTest,
  recordConversion,
  recordImpression,
  startTest,
} from '../ab-test-engine';
import type { ABTest, ABTestVariant } from '../ab-test-engine';

function variant(id: string, impressions: number, conversions: number): ABTestVariant {
  return { id, name: id, content: {}, weight: 50, impressions, conversions, conversionRate: 0 };
}

function activeTest(variants: ABTestVariant[]): ABTest {
  return {
    id: 'test-1',
    name: 'Test',
    description: '',
    type: 'cta-text',
    status: 'active',
    variants,
    startDate: new Date(),
    targetSampleSize: 100,
    currentSampleSize: 100,
    confidence: 95,
    metadata: {},
  };
}

describe('lib/ab-testing/ab-test-engine', () => {
  describe('createABTest', () => {
    it('creates a draft test with equal weights', async () => {
      const t = await createABTest({
        name: 'N',
        description: 'D',
        type: 'cta-text',
        variants: [{ name: 'A', content: {} }, { name: 'B', content: {} }],
        targetSampleSize: 50,
      });
      expect(t.status).toBe('draft');
      expect(t.variants).toHaveLength(2);
      expect(t.variants[0].weight).toBe(50);
    });
    it('throws with fewer than 2 variants', async () => {
      await expect(
        createABTest({ name: 'N', description: 'D', type: 'cta-text', variants: [{ name: 'A', content: {} }], targetSampleSize: 50 }),
      ).rejects.toThrow();
    });
  });

  describe('assignVariant', () => {
    it('returns a variant deterministically for a user', () => {
      const t = activeTest([variant('a', 0, 0), variant('b', 0, 0)]);
      const v = assignVariant(t, 'user-123');
      expect(['a', 'b']).toContain(v.id);
    });
    it('throws when test is not active', () => {
      const t = { ...activeTest([variant('a', 0, 0)]), status: 'draft' as const };
      expect(() => assignVariant(t, 'user-1')).toThrow();
    });
  });

  describe('record functions', () => {
    it('record impression and conversion log without error', async () => {
      await expect(recordImpression('t', 'a')).resolves.toBeUndefined();
      await expect(recordConversion('t', 'a')).resolves.toBeUndefined();
      expect(info).toHaveBeenCalled();
    });
  });

  describe('calculateChiSquare', () => {
    it('returns non-significant for insufficient data', () => {
      expect(calculateChiSquare([variant('a', 0, 0)]).significant).toBe(false);
      expect(calculateChiSquare([variant('a', 0, 0), variant('b', 0, 0)]).significant).toBe(false);
    });
    it('detects significance for a strong difference', () => {
      const r = calculateChiSquare([variant('a', 1000, 50), variant('b', 1000, 300)]);
      expect(r.significant).toBe(true);
      expect(r.confidence).toBeGreaterThan(0);
    });
  });

  describe('determineWinner', () => {
    it('recommends a winner when significant', () => {
      const r = determineWinner(activeTest([variant('a', 1000, 50), variant('b', 1000, 300)]));
      expect(r.statisticalSignificance).toBe(true);
      expect(r.winner?.variantId).toBe('b');
    });
    it('recommends continuing when not significant', () => {
      const r = determineWinner(activeTest([variant('a', 10, 1), variant('b', 10, 1)]));
      expect(r.statisticalSignificance).toBe(false);
      expect(r.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('lifecycle', () => {
    it('start, pause, complete log and resolve', async () => {
      await expect(startTest('t')).resolves.toBeUndefined();
      await expect(pauseTest('t')).resolves.toBeUndefined();
      await expect(completeTest('t', 'b')).resolves.toBeUndefined();
      await expect(completeTest('t')).resolves.toBeUndefined();
    });
  });

  describe('createTestFromTemplate', () => {
    it('builds a test from a template with a custom name', async () => {
      const t = await createTestFromTemplate('emailSubject', 'Custom Name', 500);
      expect(t.name).toBe('Custom Name');
      expect(t.targetSampleSize).toBe(500);
      expect(t.variants.length).toBeGreaterThanOrEqual(2);
    });
    it('falls back to the template name', async () => {
      const t = await createTestFromTemplate('ctaButton');
      expect(t.name).toBe('CTA Button Text Test');
    });
  });
});
