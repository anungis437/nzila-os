/**
 * Movement Summary Engine — Unit Tests
 *
 * Tests: posture reflects combined signals, summary changes with recs,
 * confidence bounded to [0, 1], dominant signals extracted.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyMovementPosture,
  explainMovementPosture,
  buildMovementSummary,
} from '../summaries/index.js';
import { makeDecisionOutput, makeHeightenedOutput, makePriority, makePattern, makeRecommendation } from './fixtures.js';

describe('movement summary engine', () => {
  describe('classifyMovementPosture', () => {
    it('returns steady for empty output', () => {
      const output = makeDecisionOutput();
      const result = classifyMovementPosture(output);
      expect(result).toBe('steady');
    });

    it('returns heightened for output with many critical patterns', () => {
      const output = makeHeightenedOutput();
      const result = classifyMovementPosture(output);
      expect(result).toBe('heightened');
    });

    it('returns vigilant for moderate signals', () => {
      const output = makeDecisionOutput({
        riskPosture: {
          posture: 'vigilant',
          watchAreas: ['Wages'],
          risingSectors: [],
          issueClusters: [],
          summary: 'Moderate signals.',
          confidence: 0.7,
        },
        patterns: [makePattern('P1', { watchLevel: 'elevated' })],
        recommendations: [makeRecommendation('R1', { signalId: 'P1', recommendedAction: 'escalate' })],
      });
      const result = classifyMovementPosture(output);
      expect(result).toBe('vigilant');
    });
  });

  describe('explainMovementPosture', () => {
    it('returns a non-empty explanation', () => {
      const output = makeHeightenedOutput();
      const priorities = [
        makePriority('P1', { watchLevel: 'critical' }),
      ];
      const result = explainMovementPosture('heightened', output, priorities);
      expect(result.length).toBeGreaterThan(0);
    });

    it('mentions bargaining watch when active', () => {
      const output = makeHeightenedOutput();
      const priorities = [makePriority('P1')];
      const result = explainMovementPosture('heightened', output, priorities);
      expect(result.toLowerCase()).toContain('bargaining');
    });

    it('returns explanation for steady posture', () => {
      const output = makeDecisionOutput();
      const result = explainMovementPosture('steady', output, []);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('buildMovementSummary', () => {
    it('produces a complete MovementSummary', () => {
      const output = makeHeightenedOutput();
      const priorities = [
        makePriority('P1', { watchLevel: 'critical', title: 'Wage pressure' }),
      ];
      const result = buildMovementSummary(output, priorities);

      expect(result.headline).toBeTruthy();
      expect(result.summary).toBeTruthy();
      expect(result.posture).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.dominantSignals.length).toBeGreaterThan(0);
      expect(result.whyNow).toBeTruthy();
    });

    it('confidence is bounded 0–1', () => {
      const output = makeDecisionOutput();
      const result = buildMovementSummary(output, []);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('headline includes posture word', () => {
      const output = makeHeightenedOutput();
      const priorities = [
        makePriority('P1', { watchLevel: 'critical' }),
      ];
      const result = buildMovementSummary(output, priorities);
      const postureWords = ['steady', 'vigilant', 'heightened'];
      expect(postureWords.some((w) => result.headline.toLowerCase().includes(w))).toBe(true);
    });

    it('summary changes with different recommendation mixes', () => {
      const outputA = makeDecisionOutput();
      const outputB = makeHeightenedOutput();
      const summaryA = buildMovementSummary(outputA, []);
      const summaryB = buildMovementSummary(outputB, [
        makePriority('P1', { watchLevel: 'critical' }),
      ]);
      expect(summaryA.summary).not.toEqual(summaryB.summary);
    });

    it('dominant signals are limited to top 3', () => {
      const output = makeHeightenedOutput();
      const priorities = Array.from({ length: 10 }, (_, i) =>
        makePriority(`P${i}`, { title: `Priority ${i}` }),
      );
      const result = buildMovementSummary(output, priorities);
      expect(result.dominantSignals.length).toBeLessThanOrEqual(3);
    });
  });
});
