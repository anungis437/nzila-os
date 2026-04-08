/**
 * Narrative / NIL Activation Layer — Unit Tests
 *
 * Tests: nilInvoked tracked correctly, fallback on unavailable NIL,
 * prompt contracts schema-valid, refinement applied correctly.
 */
import { describe, it, expect, vi } from 'vitest';
import type { NilReasoningService, NilRefinement, DecisionPromptContract } from '../contracts/index';
import {
  EXECUTIVE_PROMPT_CONTRACTS,
  attemptNilRefinement,
  getExecutivePromptContract,
  validateNilOutput,
} from '../narrative/index';
import {
  fallbackPostureHeadline,
  fallbackPostureSummary,
  fallbackPostureKeyTakeaway,
  fallbackPrioritySummary,
  fallbackPriorityNextStep,
  fallbackChangeSummary,
  fallbackRecommendedNextSteps,
  fallbackActionBriefHeadline,
  fallbackActionBriefSummary,
} from '../fallbacks/index';
import { makePriority } from './fixtures';
import type { MovementSummary, ExecutiveDelta } from '../contracts/index';

function makeSummary(overrides: Partial<MovementSummary> = {}): MovementSummary {
  return {
    headline: 'Heightened posture: 4 active signals',
    summary: 'Multiple high-severity signals detected.',
    posture: 'heightened',
    confidence: 0.85,
    dominantSignals: ['Wage pressure', 'Bargaining timeline'],
    whyNow: 'Escalation in mining sector.',
    ...overrides,
  };
}

function makeDelta(overrides: Partial<ExecutiveDelta> = {}): ExecutiveDelta {
  return {
    id: 'DELTA-1',
    title: 'New signal',
    direction: 'new',
    explanation: 'A new signal appeared.',
    confidence: 0.7,
    ...overrides,
  };
}

describe('narrative / NIL activation', () => {
  describe('EXECUTIVE_PROMPT_CONTRACTS', () => {
    it('has 5 executive prompt contracts', () => {
      expect(EXECUTIVE_PROMPT_CONTRACTS.length).toBe(5);
    });

    it.each(EXECUTIVE_PROMPT_CONTRACTS)('contract "$useCase" has all required fields', (contract) => {
      expect(contract.useCase).toBeTruthy();
      expect(contract.version).toBeTruthy();
      expect(contract.app).toBe('union-eyes');
      expect(contract.systemPrompt.length).toBeGreaterThan(50);
      expect(contract.requiredOutputFields.length).toBeGreaterThan(0);
      expect(contract.anonymizationRules.length).toBeGreaterThan(0);
      expect(typeof contract.buildInput).toBe('function');
    });

    it('all contracts have anonymization rules covering individual affiliates', () => {
      for (const contract of EXECUTIVE_PROMPT_CONTRACTS) {
        const hasAffiliate = contract.anonymizationRules.some((r) =>
          r.toLowerCase().includes('affiliate'),
        );
        expect(hasAffiliate).toBe(true);
      }
    });
  });

  describe('getExecutivePromptContract', () => {
    it('finds contract by use case', () => {
      const contract = getExecutivePromptContract('summarize_movement_posture_for_executives');
      expect(contract).toBeDefined();
      expect(contract!.useCase).toBe('summarize_movement_posture_for_executives');
    });

    it('returns undefined for unknown use case', () => {
      expect(getExecutivePromptContract('nonexistent')).toBeUndefined();
    });
  });

  describe('attemptNilRefinement', () => {
    const dummyContract: DecisionPromptContract = {
      useCase: 'test',
      version: '1.0.0',
      app: 'union-eyes',
      systemPrompt: 'Test',
      requiredOutputFields: ['summary'],
      anonymizationRules: [],
      buildInput: (data: unknown) => data as Record<string, unknown>,
    };

    it('returns nilInvoked=false when no service provided', async () => {
      const result = await attemptNilRefinement(undefined, dummyContract, {});
      expect(result.nilInvoked).toBe(false);
      expect(result.refinement).toBeNull();
    });

    it('returns nilInvoked=false when service is unavailable', async () => {
      const service: NilReasoningService = {
        isAvailable: () => false,
        refine: vi.fn(),
      };
      const result = await attemptNilRefinement(service, dummyContract, {});
      expect(result.nilInvoked).toBe(false);
      expect(service.refine).not.toHaveBeenCalled();
    });

    it('returns nilInvoked=true and refinement when service responds', async () => {
      const mockRefinement: NilRefinement = {
        headline: 'Refined headline',
        summary: 'Refined summary',
      };
      const service: NilReasoningService = {
        isAvailable: () => true,
        refine: vi.fn().mockResolvedValue(mockRefinement),
      };
      const result = await attemptNilRefinement(service, dummyContract, { key: 'value' });
      expect(result.nilInvoked).toBe(true);
      expect(result.refinement).toEqual(mockRefinement);
    });

    it('returns nilInvoked=true but null refinement when service fails', async () => {
      const service: NilReasoningService = {
        isAvailable: () => true,
        refine: vi.fn().mockRejectedValue(new Error('NIL offline')),
      };
      const result = await attemptNilRefinement(service, dummyContract, {});
      expect(result.nilInvoked).toBe(true);
      expect(result.refinement).toBeNull();
    });
  });

  describe('fallback layer', () => {
    it('fallbackPostureHeadline returns headline', () => {
      const summary = makeSummary();
      expect(fallbackPostureHeadline(summary)).toBe(summary.headline);
    });

    it('fallbackPostureSummary returns summary', () => {
      const summary = makeSummary();
      expect(fallbackPostureSummary(summary)).toBe(summary.summary);
    });

    it('fallbackPostureKeyTakeaway varies by posture', () => {
      const heightened = fallbackPostureKeyTakeaway(makeSummary({ posture: 'heightened' }));
      const steady = fallbackPostureKeyTakeaway(makeSummary({ posture: 'steady' }));
      expect(heightened).not.toEqual(steady);
      expect(heightened.toLowerCase()).toContain('heightened');
      expect(steady.toLowerCase()).toContain('steady');
    });

    it('fallbackPrioritySummary handles empty priorities', () => {
      expect(fallbackPrioritySummary([])).toContain('No priorities');
    });

    it('fallbackPrioritySummary mentions top priority', () => {
      const priorities = [
        makePriority('P1', { title: 'Wage pressure', watchLevel: 'critical', recommendedAction: 'intervene', timeframe: 'now' }),
      ];
      const result = fallbackPrioritySummary(priorities);
      expect(result).toContain('Wage pressure');
    });

    it('fallbackPriorityNextStep returns intervention for intervene action', () => {
      const priorities = [
        makePriority('P1', { title: 'Test issue', recommendedAction: 'intervene' }),
      ];
      expect(fallbackPriorityNextStep(priorities).toLowerCase()).toContain('convene');
    });

    it('fallbackChangeSummary handles empty deltas', () => {
      expect(fallbackChangeSummary([])).toContain('No significant changes');
    });

    it('fallbackChangeSummary lists change types', () => {
      const deltas: ExecutiveDelta[] = [
        makeDelta({ direction: 'new' }),
        makeDelta({ id: 'D2', direction: 'up' }),
        makeDelta({ id: 'D3', direction: 'resolved' }),
      ];
      const result = fallbackChangeSummary(deltas);
      expect(result).toContain('escalated');
      expect(result).toContain('new');
      expect(result).toContain('resolved');
    });

    it('fallbackRecommendedNextSteps generates actionable steps', () => {
      const priorities = [
        makePriority('P1', { recommendedAction: 'intervene', title: 'Wage crisis' }),
      ];
      const deltas = [makeDelta({ direction: 'up' })];
      const steps = fallbackRecommendedNextSteps(priorities, deltas);
      expect(steps.length).toBeGreaterThan(0);
    });

    it('fallbackActionBriefHeadline includes posture', () => {
      const summary = makeSummary({ posture: 'heightened' });
      const priorities = [
        makePriority('P1', { title: 'Test', recommendedAction: 'intervene' }),
      ];
      expect(fallbackActionBriefHeadline(summary, priorities).toLowerCase()).toContain('heightened');
    });

    it('fallbackActionBriefSummary combines all narrative parts', () => {
      const summary = makeSummary();
      const priorities = [makePriority('P1')];
      const deltas = [makeDelta()];
      const result = fallbackActionBriefSummary(summary, priorities, deltas);
      expect(result.length).toBeGreaterThan(summary.summary.length);
    });
  });

  describe('validateNilOutput', () => {
    it('returns true when all required fields are present', () => {
      const refinement: NilRefinement = {
        headline: 'Refined headline',
        summary: 'Refined summary',
      };
      expect(validateNilOutput(refinement, ['headline', 'summary'])).toBe(true);
    });

    it('returns false when a required field is missing', () => {
      const refinement: NilRefinement = {
        headline: 'Refined headline',
      };
      expect(validateNilOutput(refinement, ['headline', 'summary'])).toBe(false);
    });

    it('validates additionalFields keys', () => {
      const refinement: NilRefinement = {
        headline: 'H',
        additionalFields: { customField: 'value' },
      };
      expect(validateNilOutput(refinement, ['headline', 'customField'])).toBe(true);
    });

    it('returns true for empty required fields', () => {
      const refinement: NilRefinement = {};
      expect(validateNilOutput(refinement, [])).toBe(true);
    });
  });
});
