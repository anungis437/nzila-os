/**
 * NIL Authority + Hybrid Control — Unit Tests
 *
 * Tests: conflict resolution, bounded adjustments, hybrid modes,
 * NIL never overrides deterministic beyond ±15%.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolveConflictingSignals,
  getHybridConfig,
  applyBoundedAdjustment,
  resolveWithHybridControl,
  NIL_CONFLICT_CONTRACTS,
} from '../nil-authority/index';
import { makePriority } from './fixtures';

describe('nil-authority', () => {
  describe('resolveConflictingSignals', () => {
    it('returns monitor with full confidence for empty priorities', () => {
      const result = resolveConflictingSignals([]);
      expect(result.chosenAction).toBe('monitor');
      expect(result.confidence).toBe(1.0);
      expect(result.rejectedOptions).toHaveLength(0);
    });

    it('returns single priority action unchanged', () => {
      const p = makePriority('P1', {
        recommendedAction: 'escalate',
        confidence: 0.85,
        priorityScore: 0.8,
      });
      const result = resolveConflictingSignals([p]);
      expect(result.chosenAction).toBe('escalate');
      expect(result.confidence).toBe(0.85);
      expect(result.rejectedOptions).toHaveLength(0);
    });

    it('chooses higher priority score when actions conflict', () => {
      const p1 = makePriority('P1', {
        recommendedAction: 'intervene',
        confidence: 0.9,
        priorityScore: 0.9,
      });
      const p2 = makePriority('P2', {
        recommendedAction: 'monitor',
        confidence: 0.7,
        priorityScore: 0.5,
      });
      const result = resolveConflictingSignals([p1, p2]);
      expect(result.chosenAction).toBe('intervene');
      expect(result.rejectedOptions.length).toBeGreaterThan(0);
      expect(result.tradeoffs.length).toBeGreaterThan(0);
    });

    it('identifies no tradeoffs when all actions agree', () => {
      const p1 = makePriority('P1', { recommendedAction: 'escalate', priorityScore: 0.8 });
      const p2 = makePriority('P2', { recommendedAction: 'escalate', priorityScore: 0.6 });
      const result = resolveConflictingSignals([p1, p2]);
      expect(result.chosenAction).toBe('escalate');
      expect(result.tradeoffs).toHaveLength(0);
      expect(result.reasoning).toContain('agree');
    });

    it('reduces confidence when confidence spread is large', () => {
      const p1 = makePriority('P1', {
        recommendedAction: 'intervene',
        confidence: 0.95,
        priorityScore: 0.9,
      });
      const p2 = makePriority('P2', {
        recommendedAction: 'monitor',
        confidence: 0.3,
        priorityScore: 0.4,
      });
      const result = resolveConflictingSignals([p1, p2]);
      // Confidence should be reduced due to spread
      expect(result.confidence).toBeLessThan(0.95);
    });

    it('collects evidence refs from all priorities', () => {
      const p1 = makePriority('P1', { evidenceRefs: ['ref:A', 'ref:B'], priorityScore: 0.8 });
      const p2 = makePriority('P2', { evidenceRefs: ['ref:B', 'ref:C'], priorityScore: 0.6 });
      const result = resolveConflictingSignals([p1, p2]);
      expect(result.evidenceRefs).toContain('ref:A');
      expect(result.evidenceRefs).toContain('ref:B');
      expect(result.evidenceRefs).toContain('ref:C');
      // Deduped
      expect(result.evidenceRefs.filter((r) => r === 'ref:B')).toHaveLength(1);
    });
  });

  describe('getHybridConfig', () => {
    it('returns hybrid config by default', () => {
      const config = getHybridConfig();
      expect(config.mode).toBe('hybrid');
      expect(config.maxAdjustment).toBe(0.15);
    });

    it('returns zero adjustment for deterministic_only', () => {
      const config = getHybridConfig('deterministic_only');
      expect(config.mode).toBe('deterministic_only');
      expect(config.maxAdjustment).toBe(0);
    });

    it('allows full adjustment for nil_weighted', () => {
      const config = getHybridConfig('nil_weighted');
      expect(config.mode).toBe('nil_weighted');
      expect(config.maxAdjustment).toBe(0.15);
    });
  });

  describe('applyBoundedAdjustment', () => {
    it('returns base score unchanged in deterministic_only mode', () => {
      const config = getHybridConfig('deterministic_only');
      expect(applyBoundedAdjustment(0.7, 0.5, config)).toBe(0.7);
    });

    it('applies dampened adjustment in hybrid mode', () => {
      const config = getHybridConfig('hybrid');
      const result = applyBoundedAdjustment(0.5, 0.2, config);
      // 0.2 * 0.5 = 0.1, within ±0.15 bounds
      expect(result).toBeCloseTo(0.6, 2);
    });

    it('bounds adjustment to ±15% in hybrid mode', () => {
      const config = getHybridConfig('hybrid');
      const result = applyBoundedAdjustment(0.5, 0.8, config);
      // 0.8 * 0.5 = 0.4, bounded to 0.15
      expect(result).toBeCloseTo(0.65, 2);
    });

    it('bounds adjustment to ±15% in nil_weighted mode', () => {
      const config = getHybridConfig('nil_weighted');
      const result = applyBoundedAdjustment(0.5, 0.5, config);
      // 0.5 bounded to 0.15
      expect(result).toBeCloseTo(0.65, 2);
    });

    it('never produces scores below 0 or above 1', () => {
      const config = getHybridConfig('nil_weighted');
      expect(applyBoundedAdjustment(0.02, -0.5, config)).toBe(0);
      expect(applyBoundedAdjustment(0.98, 0.5, config)).toBe(1);
    });
  });

  describe('resolveWithHybridControl', () => {
    it('returns deterministic result when mode is deterministic_only', async () => {
      const result = await resolveWithHybridControl(
        [makePriority('P1', { recommendedAction: 'escalate', priorityScore: 0.8 })],
        undefined,
        'deterministic_only',
      );
      expect(result.chosenAction).toBe('escalate');
    });

    it('returns deterministic result when nilService is unavailable', async () => {
      const nilService = { isAvailable: () => false, refine: vi.fn() };
      const result = await resolveWithHybridControl(
        [makePriority('P1', { recommendedAction: 'intervene', priorityScore: 0.9 })],
        nilService,
      );
      expect(result.chosenAction).toBe('intervene');
      expect(nilService.refine).not.toHaveBeenCalled();
    });

    it('handles NIL failure gracefully', async () => {
      const nilService = {
        isAvailable: () => true,
        refine: vi.fn().mockRejectedValue(new Error('NIL offline')),
      };
      const result = await resolveWithHybridControl(
        [makePriority('P1', { recommendedAction: 'escalate', priorityScore: 0.8 })],
        nilService,
      );
      expect(result.chosenAction).toBe('escalate');
    });
  });

  describe('NIL_CONFLICT_CONTRACTS', () => {
    it('exposes 3 prompt contracts', () => {
      expect(NIL_CONFLICT_CONTRACTS).toHaveLength(3);
    });

    it('all contracts have required fields', () => {
      for (const contract of NIL_CONFLICT_CONTRACTS) {
        expect(contract.useCase).toBeTruthy();
        expect(contract.systemPrompt).toBeTruthy();
        expect(contract.requiredOutputFields.length).toBeGreaterThan(0);
        expect(contract.anonymizationRules.length).toBeGreaterThan(0);
      }
    });

    it('all contracts have anonymization rules', () => {
      for (const contract of NIL_CONFLICT_CONTRACTS) {
        expect(contract.anonymizationRules.some((r) =>
          r.toLowerCase().includes('never name'),
        )).toBe(true);
      }
    });
  });
});
