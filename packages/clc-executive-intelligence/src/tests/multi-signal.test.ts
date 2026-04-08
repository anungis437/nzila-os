/**
 * Multi-Signal Reasoning Engine — Unit Tests
 *
 * Tests: reinforcing signals boost priority, conflicting signals reduce
 * confidence, cascading effects detected, independent signals leave score unchanged.
 */
import { describe, it, expect } from 'vitest';
import { analyzeMultipleSignals } from '../reasoning/multi-signal-engine';
import { makePriority } from './fixtures';

describe('multi-signal reasoning engine', () => {
  it('returns zero-state for empty priorities', () => {
    const result = analyzeMultipleSignals([]);
    expect(result.combinedImpactScore).toBe(0);
    expect(result.interactionType).toBe('independent');
    expect(result.adjustmentFactor).toBe(0);
    expect(result.signalPairs).toHaveLength(0);
  });

  it('returns independent for single signal', () => {
    const result = analyzeMultipleSignals([
      makePriority('P1', { priorityScore: 0.7 }),
    ]);
    expect(result.combinedImpactScore).toBe(0.7);
    expect(result.interactionType).toBe('independent');
    expect(result.signalPairs).toHaveLength(0);
  });

  it('detects reinforcing signals with same action and overlapping sources', () => {
    const result = analyzeMultipleSignals([
      makePriority('P1', {
        recommendedAction: 'escalate',
        sourceTypes: ['cross_affiliate_issue_cluster'],
        priorityScore: 0.8,
      }),
      makePriority('P2', {
        recommendedAction: 'escalate',
        sourceTypes: ['cross_affiliate_issue_cluster'],
        priorityScore: 0.7,
      }),
    ]);
    expect(result.interactionType).toBe('reinforcing');
    expect(result.adjustmentFactor).toBeGreaterThan(0);
    expect(result.signalPairs).toHaveLength(1);
    expect(result.signalPairs[0]!.interaction).toBe('reinforcing');
  });

  it('detects conflicting signals with opposing actions', () => {
    const result = analyzeMultipleSignals([
      makePriority('P1', {
        recommendedAction: 'intervene',
        sourceTypes: ['type_a'],
        priorityScore: 0.9,
      }),
      makePriority('P2', {
        recommendedAction: 'monitor',
        sourceTypes: ['type_b'],
        priorityScore: 0.4,
      }),
    ]);
    expect(result.interactionType).toBe('conflicting');
    expect(result.adjustmentFactor).toBeLessThan(0);
  });

  it('reinforcing signals increase combined impact score', () => {
    const baseResult = analyzeMultipleSignals([
      makePriority('P1', {
        recommendedAction: 'monitor',
        sourceTypes: ['type_a'],
        priorityScore: 0.5,
      }),
      makePriority('P2', {
        recommendedAction: 'prepare',
        sourceTypes: ['type_b'],
        priorityScore: 0.5,
      }),
    ]);

    const reinforcedResult = analyzeMultipleSignals([
      makePriority('P1', {
        recommendedAction: 'escalate',
        sourceTypes: ['cross_affiliate_issue_cluster'],
        priorityScore: 0.5,
      }),
      makePriority('P2', {
        recommendedAction: 'escalate',
        sourceTypes: ['cross_affiliate_issue_cluster'],
        priorityScore: 0.5,
      }),
    ]);

    expect(reinforcedResult.combinedImpactScore).toBeGreaterThan(baseResult.combinedImpactScore);
  });

  it('detects cascading effects for bargaining + shift', () => {
    const result = analyzeMultipleSignals([
      makePriority('P1', {
        sourceTypes: ['bargaining_pressure_signal'],
        priorityScore: 0.7,
      }),
      makePriority('P2', {
        sourceTypes: ['cross_sector_shift'],
        priorityScore: 0.6,
      }),
    ]);
    expect(result.summary).toContain('cascading');
    expect(result.adjustmentFactor).toBeGreaterThan(0);
  });

  it('penalizes high severity + low confidence signals', () => {
    const result = analyzeMultipleSignals([
      makePriority('P1', {
        watchLevel: 'critical',
        confidence: 0.3,
        priorityScore: 0.8,
      }),
      makePriority('P2', {
        watchLevel: 'high',
        confidence: 0.35,
        priorityScore: 0.7,
      }),
    ]);
    expect(result.summary).toContain('low-confidence');
  });

  it('bounds adjustment factor to [-0.3, +0.3]', () => {
    // Even with many reinforcing signals, stays bounded
    const priorities = Array.from({ length: 6 }, (_, i) =>
      makePriority(`P${i}`, {
        recommendedAction: 'escalate',
        sourceTypes: ['cross_affiliate_issue_cluster'],
        priorityScore: 0.9,
      }),
    );
    const result = analyzeMultipleSignals(priorities);
    expect(result.adjustmentFactor).toBeLessThanOrEqual(0.3);
    expect(result.adjustmentFactor).toBeGreaterThanOrEqual(-0.3);
  });

  it('generates correct signal pairs count (n choose 2)', () => {
    const priorities = Array.from({ length: 4 }, (_, i) =>
      makePriority(`P${i}`, { sourceTypes: [`type_${i}`], priorityScore: 0.5 }),
    );
    const result = analyzeMultipleSignals(priorities);
    // 4 choose 2 = 6
    expect(result.signalPairs).toHaveLength(6);
  });
});
