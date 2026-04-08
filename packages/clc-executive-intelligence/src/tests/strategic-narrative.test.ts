/**
 * Strategic Narrative Engine — Unit Tests
 *
 * Tests: outlook classification, action window selection,
 * strategic implication text, full narrative builder.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyOutlook,
  classifyActionWindow,
  buildStrategicNarrative,
} from '../narrative/strategic';
import { makePriority } from './fixtures';
import type { MovementSummary, ExecutiveDelta } from '../contracts/index';

function makeSummary(overrides: Partial<MovementSummary> = {}): MovementSummary {
  return {
    headline: 'Test headline',
    summary: 'Test summary',
    posture: 'steady',
    confidence: 0.75,
    dominantSignals: ['Signal A'],
    whyNow: 'Test why now',
    ...overrides,
  };
}

function makeDelta(direction: 'up' | 'down' | 'new' | 'resolved'): ExecutiveDelta {
  return {
    id: `D-${direction}`,
    title: `Delta ${direction}`,
    direction,
    explanation: `Test ${direction}`,
    confidence: 0.7,
  };
}

describe('strategic narrative engine', () => {
  describe('classifyOutlook', () => {
    it('returns stable for steady posture with no deltas', () => {
      const result = classifyOutlook(
        makeSummary({ posture: 'steady' }),
        [],
        [makePriority('P1')],
      );
      expect(result).toBe('stable');
    });

    it('returns worsening for heightened posture with escalations', () => {
      const result = classifyOutlook(
        makeSummary({ posture: 'heightened' }),
        [makeDelta('up'), makeDelta('new')],
        [makePriority('P1', { watchLevel: 'critical' })],
      );
      expect(result).toBe('worsening');
    });

    it('returns improving for steady posture with deescalations', () => {
      const result = classifyOutlook(
        makeSummary({ posture: 'steady' }),
        [makeDelta('resolved'), makeDelta('down')],
        [makePriority('P1')],
      );
      expect(result).toBe('improving');
    });

    it('returns worsening when escalations dominate', () => {
      const result = classifyOutlook(
        makeSummary({ posture: 'vigilant' }),
        [makeDelta('up'), makeDelta('new'), makeDelta('up')],
        [makePriority('P1')],
      );
      expect(result).toBe('worsening');
    });

    it('returns improving when deescalations dominate', () => {
      const result = classifyOutlook(
        makeSummary({ posture: 'vigilant' }),
        [makeDelta('down'), makeDelta('resolved'), makeDelta('resolved')],
        [makePriority('P1')],
      );
      expect(result).toBe('improving');
    });

    it('returns worsening when multiple critical priorities', () => {
      const result = classifyOutlook(
        makeSummary({ posture: 'vigilant' }),
        [],
        [
          makePriority('P1', { watchLevel: 'critical', recommendedAction: 'intervene' }),
          makePriority('P2', { watchLevel: 'critical', recommendedAction: 'intervene' }),
        ],
      );
      expect(result).toBe('worsening');
    });
  });

  describe('classifyActionWindow', () => {
    it('returns immediate for intervene actions', () => {
      const result = classifyActionWindow(
        [makePriority('P1', { recommendedAction: 'intervene', timeframe: 'now' })],
        false,
      );
      expect(result).toBe('immediate');
    });

    it('returns bargaining_cycle when watch is active', () => {
      const result = classifyActionWindow(
        [makePriority('P1', { recommendedAction: 'prepare', timeframe: '30_days' })],
        true,
      );
      expect(result).toBe('bargaining_cycle');
    });

    it('returns short_term for escalate actions', () => {
      const result = classifyActionWindow(
        [makePriority('P1', { recommendedAction: 'escalate', timeframe: '7_days' })],
        false,
      );
      expect(result).toBe('short_term');
    });

    it('returns short_term by default', () => {
      const result = classifyActionWindow(
        [makePriority('P1', { recommendedAction: 'monitor', timeframe: 'this_quarter' })],
        false,
      );
      expect(result).toBe('short_term');
    });
  });

  describe('buildStrategicNarrative', () => {
    it('builds complete narrative', () => {
      const result = buildStrategicNarrative(
        makeSummary(),
        [makePriority('P1')],
        [],
        false,
      );
      expect(result.outlook).toBeTruthy();
      expect(result.strategicImplication).toBeTruthy();
      expect(result.nextWindow).toBeTruthy();
    });

    it('stable outlook mentions routine oversight', () => {
      const result = buildStrategicNarrative(
        makeSummary({ posture: 'steady' }),
        [makePriority('P1', { title: 'Test Priority' })],
        [],
        false,
      );
      expect(result.outlook).toBe('stable');
      expect(result.strategicImplication).toContain('stable');
    });

    it('worsening outlook mentions deteriorating', () => {
      const result = buildStrategicNarrative(
        makeSummary({ posture: 'heightened' }),
        [makePriority('P1', { recommendedAction: 'intervene', timeframe: 'now' })],
        [makeDelta('up'), makeDelta('new')],
        false,
      );
      expect(result.outlook).toBe('worsening');
      expect(result.strategicImplication.toLowerCase()).toContain('deteriorat');
    });

    it('improving outlook mentions maintaining', () => {
      const result = buildStrategicNarrative(
        makeSummary({ posture: 'steady' }),
        [makePriority('P1')],
        [makeDelta('resolved'), makeDelta('down')],
        false,
      );
      expect(result.outlook).toBe('improving');
      expect(result.strategicImplication.toLowerCase()).toContain('improv');
    });

    it('bargaining watch affects action window', () => {
      const result = buildStrategicNarrative(
        makeSummary(),
        [makePriority('P1', { recommendedAction: 'prepare' })],
        [],
        true,
      );
      expect(result.nextWindow).toBe('bargaining_cycle');
    });
  });
});
