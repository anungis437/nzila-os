/**
 * Comparisons / Delta Engine — Unit Tests
 *
 * Tests: new signals, escalations, de-escalations, resolutions,
 * no-previous-snapshot, posture change, bargaining watch change.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSnapshot,
  detectNewSignals,
  detectEscalations,
  detectResolutions,
  compareExecutiveSnapshots,
} from '../comparisons/index';
import { makeDecisionOutput, makeHeightenedOutput, makeSnapshot, makePattern, makeRecommendation } from './fixtures';

describe('comparisons / delta engine', () => {
  describe('buildSnapshot', () => {
    it('creates a snapshot with all required fields', () => {
      const output = makeHeightenedOutput();
      const snap = buildSnapshot(output, ['P1']);

      expect(snap.id).toMatch(/^SNAP-/);
      expect(snap.generatedAt).toBeTruthy();
      expect(snap.posture).toBe('heightened');
      expect(snap.confidence).toBe(0.85);
      expect(snap.activePatternIds).toContain('P1');
      expect(snap.topPriorityIds).toEqual(['P1']);
      expect(snap.bargainingWatchActive).toBe(true);
      expect(snap.briefingCardCount).toBe(1);
    });

    it('records action counts correctly', () => {
      const output = makeHeightenedOutput();
      const snap = buildSnapshot(output, []);

      expect(snap.actionCounts.intervene).toBe(1);
      expect(snap.actionCounts.escalate).toBe(1);
      expect(snap.actionCounts.prepare).toBe(1);
      expect(snap.actionCounts.monitor).toBe(1);
    });

    it('records pattern watch levels', () => {
      const output = makeHeightenedOutput();
      const snap = buildSnapshot(output, []);

      expect(snap.patternWatchLevels['P1']).toBe('critical');
      expect(snap.patternWatchLevels['P2']).toBe('high');
    });
  });

  describe('detectNewSignals', () => {
    it('returns patterns not in previous snapshot', () => {
      const output = makeHeightenedOutput();
      const previous = makeSnapshot({ activePatternIds: ['P1'] });

      const deltas = detectNewSignals(output, previous);
      expect(deltas.length).toBe(3); // P2, P3, P4 are new
      expect(deltas.every((d) => d.direction === 'new')).toBe(true);
    });

    it('returns empty when all patterns are known', () => {
      const output = makeHeightenedOutput();
      const previous = makeSnapshot({
        activePatternIds: ['P1', 'P2', 'P3', 'P4'],
      });

      const deltas = detectNewSignals(output, previous);
      expect(deltas).toEqual([]);
    });
  });

  describe('detectEscalations', () => {
    it('detects watch level increase', () => {
      const output = makeDecisionOutput({
        patterns: [makePattern('P1', { watchLevel: 'critical' })],
      });
      const previous = makeSnapshot({
        activePatternIds: ['P1'],
        patternWatchLevels: { P1: 'elevated' },
      });

      const deltas = detectEscalations(output, previous);
      expect(deltas.length).toBe(1);
      expect(deltas[0]!.direction).toBe('up');
      expect(deltas[0]!.previousState).toBe('elevated');
      expect(deltas[0]!.currentState).toBe('critical');
    });

    it('ignores same watch level', () => {
      const output = makeDecisionOutput({
        patterns: [makePattern('P1', { watchLevel: 'elevated' })],
      });
      const previous = makeSnapshot({
        activePatternIds: ['P1'],
        patternWatchLevels: { P1: 'elevated' },
      });

      const deltas = detectEscalations(output, previous);
      expect(deltas).toEqual([]);
    });
  });

  describe('detectResolutions', () => {
    it('detects patterns that disappeared', () => {
      const output = makeDecisionOutput({ patterns: [] });
      const previous = makeSnapshot({
        activePatternIds: ['P1', 'P2'],
        patternWatchLevels: { P1: 'high', P2: 'elevated' },
      });

      const deltas = detectResolutions(output, previous);
      expect(deltas.length).toBe(2);
      expect(deltas.every((d) => d.direction === 'resolved')).toBe(true);
    });

    it('returns empty when no patterns resolved', () => {
      const output = makeHeightenedOutput();
      const previous = makeSnapshot({
        activePatternIds: ['P1', 'P2', 'P3', 'P4'],
      });

      const deltas = detectResolutions(output, previous);
      expect(deltas).toEqual([]);
    });
  });

  describe('compareExecutiveSnapshots', () => {
    it('returns empty array for null previous snapshot', () => {
      const output = makeHeightenedOutput();
      const deltas = compareExecutiveSnapshots(output, null);
      expect(deltas).toEqual([]);
    });

    it('detects all delta types together', () => {
      const output = makeDecisionOutput({
        riskPosture: {
          posture: 'heightened',
          watchAreas: [],
          risingSectors: [],
          issueClusters: [],
          summary: 'Escalated.',
          confidence: 0.85,
        },
        patterns: [
          makePattern('P1', { watchLevel: 'critical' }), // escalated from elevated
          makePattern('P3', { watchLevel: 'elevated' }), // new
        ],
        recommendations: [],
        bargainingWatch: null,
      });

      const previous = makeSnapshot({
        posture: 'steady',
        activePatternIds: ['P1', 'P2'], // P2 resolved
        patternWatchLevels: { P1: 'elevated', P2: 'high' },
        bargainingWatchActive: false,
      });

      const deltas = compareExecutiveSnapshots(output, previous);

      // Should have: posture change, P1 escalation, P3 new, P2 resolved
      expect(deltas.length).toBeGreaterThanOrEqual(4);
      expect(deltas.some((d) => d.id === 'DELTA-POSTURE')).toBe(true);
      expect(deltas.some((d) => d.direction === 'up')).toBe(true);
      expect(deltas.some((d) => d.direction === 'new')).toBe(true);
      expect(deltas.some((d) => d.direction === 'resolved')).toBe(true);
    });

    it('posture change is first in sorted results', () => {
      const output = makeDecisionOutput({
        riskPosture: {
          posture: 'heightened',
          watchAreas: [],
          risingSectors: [],
          issueClusters: [],
          summary: 'Changed.',
          confidence: 0.8,
        },
        patterns: [makePattern('NEW1')],
      });
      const previous = makeSnapshot({ posture: 'steady' });

      const deltas = compareExecutiveSnapshots(output, previous);
      expect(deltas[0]!.id).toBe('DELTA-POSTURE');
    });

    it('detects bargaining watch activation', () => {
      const output = makeHeightenedOutput(); // has bargaining watch
      const previous = makeSnapshot({ bargainingWatchActive: false });

      const deltas = compareExecutiveSnapshots(output, previous);
      const bargaining = deltas.find((d) => d.id === 'DELTA-BARG-WATCH-NEW');
      expect(bargaining).toBeDefined();
      expect(bargaining!.direction).toBe('new');
    });

    it('detects bargaining watch deactivation', () => {
      const output = makeDecisionOutput({ bargainingWatch: null });
      const previous = makeSnapshot({ bargainingWatchActive: true });

      const deltas = compareExecutiveSnapshots(output, previous);
      const bargaining = deltas.find((d) => d.id === 'DELTA-BARG-WATCH-RESOLVED');
      expect(bargaining).toBeDefined();
      expect(bargaining!.direction).toBe('resolved');
    });

    it('detects de-escalation when watch level decreases', () => {
      const output = makeDecisionOutput({
        patterns: [makePattern('P1', { watchLevel: 'elevated' })],
      });
      const previous = makeSnapshot({
        activePatternIds: ['P1'],
        patternWatchLevels: { P1: 'critical' },
      });

      const deltas = compareExecutiveSnapshots(output, previous);
      const deesc = deltas.find((d) => d.id === 'DELTA-DEESC-P1');
      expect(deesc).toBeDefined();
      expect(deesc!.direction).toBe('down');
      expect(deesc!.previousState).toBe('critical');
      expect(deesc!.currentState).toBe('elevated');
    });
  });
});
