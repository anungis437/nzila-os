/**
 * Prioritization Engine — Unit Tests
 *
 * Tests: severe+broad outranks narrow, confidence can outrank watch level,
 * novelty promotion, score boundaries, empty inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  computeExecutivePriorityScore,
  rankExecutivePriorities,
  selectTopExecutivePriorities,
} from '../prioritization/index.js';
import { makePattern, makeRecommendation, makeDecisionOutput, makeHeightenedOutput } from './fixtures.js';

describe('prioritization engine', () => {
  describe('computeExecutivePriorityScore', () => {
    it('returns a score between 0 and 1', () => {
      const score = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'monitor',
        timeframe: 'this_quarter',
        confidence: 0.5,
        affectedSectorCount: 1,
        velocity: 0,
        isNovel: false,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('critical+intervene scores higher than monitor+monitor', () => {
      const critical = computeExecutivePriorityScore({
        watchLevel: 'critical',
        recommendedAction: 'intervene',
        timeframe: 'now',
        confidence: 0.9,
        affectedSectorCount: 3,
        velocity: 2,
        isNovel: true,
      });
      const monitoring = computeExecutivePriorityScore({
        watchLevel: 'monitor',
        recommendedAction: 'monitor',
        timeframe: 'this_quarter',
        confidence: 0.3,
        affectedSectorCount: 1,
        velocity: 0,
        isNovel: false,
      });
      expect(critical).toBeGreaterThan(monitoring);
    });

    it('severe+broad outranks severe+narrow', () => {
      const broad = computeExecutivePriorityScore({
        watchLevel: 'critical',
        recommendedAction: 'intervene',
        timeframe: 'now',
        confidence: 0.8,
        affectedSectorCount: 5,
        velocity: 1,
        isNovel: false,
      });
      const narrow = computeExecutivePriorityScore({
        watchLevel: 'critical',
        recommendedAction: 'intervene',
        timeframe: 'now',
        confidence: 0.8,
        affectedSectorCount: 1,
        velocity: 1,
        isNovel: false,
      });
      expect(broad).toBeGreaterThan(narrow);
    });

    it('high confidence can compensate for lower watch level', () => {
      const highConfLowerWatch = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'escalate',
        timeframe: 'now',
        confidence: 1.0,
        affectedSectorCount: 4,
        velocity: 2,
        isNovel: true,
      });
      const lowConfHighWatch = computeExecutivePriorityScore({
        watchLevel: 'high',
        recommendedAction: 'monitor',
        timeframe: 'this_quarter',
        confidence: 0.2,
        affectedSectorCount: 1,
        velocity: 0,
        isNovel: false,
      });
      expect(highConfLowerWatch).toBeGreaterThan(lowConfHighWatch);
    });

    it('novelty adds a promotion bonus', () => {
      const novel = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'prepare',
        timeframe: '30_days',
        confidence: 0.7,
        affectedSectorCount: 2,
        velocity: 1,
        isNovel: true,
      });
      const familiar = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'prepare',
        timeframe: '30_days',
        confidence: 0.7,
        affectedSectorCount: 2,
        velocity: 1,
        isNovel: false,
      });
      expect(novel).toBeGreaterThan(familiar);
    });

    it('velocity alone changes ranking (velocity isolation)', () => {
      const highVelocity = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'prepare',
        timeframe: '30_days',
        confidence: 0.6,
        affectedSectorCount: 2,
        velocity: 3,
        isNovel: false,
      });
      const zeroVelocity = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'prepare',
        timeframe: '30_days',
        confidence: 0.6,
        affectedSectorCount: 2,
        velocity: 0,
        isNovel: false,
      });
      expect(highVelocity).toBeGreaterThan(zeroVelocity);
    });

    it('timeframe "now" outranks "this_quarter" with all else equal', () => {
      const imminent = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'prepare',
        timeframe: 'now',
        confidence: 0.6,
        affectedSectorCount: 2,
        velocity: 1,
        isNovel: false,
      });
      const quarterly = computeExecutivePriorityScore({
        watchLevel: 'elevated',
        recommendedAction: 'prepare',
        timeframe: 'this_quarter',
        confidence: 0.6,
        affectedSectorCount: 2,
        velocity: 1,
        isNovel: false,
      });
      expect(imminent).toBeGreaterThan(quarterly);
    });
  });

  describe('rankExecutivePriorities', () => {
    it('returns empty array for empty output', () => {
      const output = makeDecisionOutput();
      const result = rankExecutivePriorities(output);
      expect(result).toEqual([]);
    });

    it('ranks priorities in descending score order', () => {
      const output = makeHeightenedOutput();
      const result = rankExecutivePriorities(output);
      expect(result.length).toBeGreaterThan(0);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]!.priorityScore).toBeGreaterThanOrEqual(result[i]!.priorityScore);
      }
    });

    it('includes bargaining watch as a priority when active', () => {
      const output = makeHeightenedOutput();
      const result = rankExecutivePriorities(output);
      const bargaining = result.find((p) => p.id.toLowerCase().includes('bargaining'));
      expect(bargaining).toBeDefined();
    });

    it('marks novel patterns when knownPatternIds provided', () => {
      const output = makeHeightenedOutput();
      const knownIds = new Set(['P1']); // P2, P3, P4 are novel
      const result = rankExecutivePriorities(output, knownIds);
      const novel = result.filter((p) => p.sourceTypes.includes('novel'));
      expect(novel.length).toBeGreaterThan(0);
    });

    it('each priority has source types, evidence refs, and whyItMatters', () => {
      const output = makeHeightenedOutput();
      const result = rankExecutivePriorities(output);
      for (const p of result) {
        expect(p.sourceTypes.length).toBeGreaterThan(0);
        expect(p.evidenceRefs.length).toBeGreaterThan(0);
        expect(p.whyItMatters.length).toBeGreaterThan(0);
      }
    });
  });

  describe('selectTopExecutivePriorities', () => {
    it('limits results to maxPriorities', () => {
      const output = makeHeightenedOutput();
      const result = selectTopExecutivePriorities(output, 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('defaults to 5 priorities', () => {
      const output = makeHeightenedOutput();
      const result = selectTopExecutivePriorities(output);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('returns fewer priorities if output has fewer patterns', () => {
      const output = makeDecisionOutput({
        patterns: [makePattern('P1', { watchLevel: 'high' })],
        recommendations: [makeRecommendation('R1', { signalId: 'P1' })],
      });
      const result = selectTopExecutivePriorities(output, 5);
      expect(result.length).toBeLessThanOrEqual(2); // 1 pattern + maybe not bargaining
    });
  });
});
