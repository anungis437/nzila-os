/**
 * Decision Sequencing Engine — Unit Tests
 *
 * Tests: actions ordered correctly, prerequisites detected,
 * conflicts flagged, top-one-priority derived accurately.
 */
import { describe, it, expect } from 'vitest';
import { buildActionSequence, deriveTopOnePriority } from '../recommendations/sequence-engine';
import { makePriority } from './fixtures';

describe('decision sequencing engine', () => {
  describe('buildActionSequence', () => {
    it('returns empty sequence for no priorities', () => {
      const result = buildActionSequence([]);
      expect(result.orderedActions).toHaveLength(0);
      expect(result.primaryAction).toBeNull();
      expect(result.secondaryActions).toHaveLength(0);
    });

    it('places single priority as primary action', () => {
      const result = buildActionSequence([
        makePriority('P1', { recommendedAction: 'escalate' }),
      ]);
      expect(result.orderedActions).toHaveLength(1);
      expect(result.primaryAction).not.toBeNull();
      expect(result.primaryAction!.step).toBe(1);
      expect(result.secondaryActions).toHaveLength(0);
    });

    it('orders intervene before monitor', () => {
      const result = buildActionSequence([
        makePriority('P1', {
          recommendedAction: 'monitor',
          timeframe: 'this_quarter',
          confidence: 0.5,
          priorityScore: 0.3,
        }),
        makePriority('P2', {
          recommendedAction: 'intervene',
          timeframe: 'now',
          confidence: 0.9,
          priorityScore: 0.9,
        }),
      ]);
      expect(result.primaryAction!.action).toContain('P2');
    });

    it('assigns sequential step numbers', () => {
      const priorities = [
        makePriority('P1', { recommendedAction: 'intervene', timeframe: 'now', confidence: 0.9 }),
        makePriority('P2', { recommendedAction: 'escalate', timeframe: '7_days', confidence: 0.8 }),
        makePriority('P3', { recommendedAction: 'monitor', timeframe: 'this_quarter', confidence: 0.5 }),
      ];
      const result = buildActionSequence(priorities);
      const steps = result.orderedActions.map((a) => a.step);
      expect(steps).toEqual([1, 2, 3]);
    });

    it('separates primary and secondary actions', () => {
      const priorities = [
        makePriority('P1', { recommendedAction: 'intervene', timeframe: 'now', confidence: 0.9 }),
        makePriority('P2', { recommendedAction: 'escalate', timeframe: '7_days', confidence: 0.8 }),
      ];
      const result = buildActionSequence(priorities);
      expect(result.primaryAction).not.toBeNull();
      expect(result.secondaryActions).toHaveLength(1);
    });

    it('each action has rationale', () => {
      const result = buildActionSequence([
        makePriority('P1', { recommendedAction: 'escalate', confidence: 0.85 }),
      ]);
      expect(result.orderedActions[0]!.rationale).toBeTruthy();
    });

    it('handles many priorities without error', () => {
      const priorities = Array.from({ length: 10 }, (_, i) =>
        makePriority(`P${i}`, {
          recommendedAction: i < 2 ? 'intervene' : i < 5 ? 'escalate' : 'monitor',
          priorityScore: 1 - i * 0.08,
        }),
      );
      const result = buildActionSequence(priorities);
      expect(result.orderedActions).toHaveLength(10);
    });
  });

  describe('deriveTopOnePriority', () => {
    it('returns null for empty priorities', () => {
      const result = deriveTopOnePriority([]);
      expect(result).toBeNull();
    });

    it('derives top-one from single priority', () => {
      const result = deriveTopOnePriority([
        makePriority('P1', {
          title: 'Wage Pressure',
          recommendedAction: 'intervene',
          timeframe: 'now',
          confidence: 0.9,
          priorityScore: 0.9,
        }),
      ]);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Wage Pressure');
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it('selects first priority as top one (input must be pre-sorted)', () => {
      // deriveTopOnePriority picks priorities[0] — caller must pre-sort
      const result = deriveTopOnePriority([
        makePriority('P2', {
          title: 'High Priority',
          priorityScore: 0.9,
          recommendedAction: 'intervene',
        }),
        makePriority('P1', {
          title: 'Low Priority',
          priorityScore: 0.3,
          recommendedAction: 'monitor',
        }),
      ]);
      expect(result!.title).toBe('High Priority');
    });

    it('includes whyThisIsTheOne explanation', () => {
      const result = deriveTopOnePriority([
        makePriority('P1', { priorityScore: 0.8, recommendedAction: 'escalate' }),
      ]);
      expect(result!.whyThisIsTheOne).toBeTruthy();
      expect(result!.whyThisIsTheOne.length).toBeGreaterThan(10);
    });

    it('includes immediateAction', () => {
      const result = deriveTopOnePriority([
        makePriority('P1', {
          recommendedAction: 'intervene',
          priorityScore: 0.9,
        }),
      ]);
      expect(result!.immediateAction).toBeTruthy();
    });

    it('preserves timeframe from source priority', () => {
      const result = deriveTopOnePriority([
        makePriority('P1', {
          timeframe: '7_days',
          priorityScore: 0.8,
        }),
      ]);
      expect(result!.timeframe).toBe('7_days');
    });
  });
});
