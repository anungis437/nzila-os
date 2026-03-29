import { describe, it, expect } from 'vitest';
import {
  computeSLAStatus,
  caseComparator,
  matchShortcut,
  SLA_HOURS,
  EMPTY_STATES,
  WORKBENCH_SHORTCUTS,
} from '../workbench-utils';

describe('workbench-utils', () => {
  describe('computeSLAStatus', () => {
    it('returns ok when plenty of time remains', () => {
      const created = new Date();
      const result = computeSLAStatus('low', created, new Date());
      expect(result.urgency).toBe('ok');
      expect(result.remainingHours).toBeGreaterThan(0);
    });

    it('returns overdue when time exceeded', () => {
      const created = new Date('2020-01-01');
      const result = computeSLAStatus('critical', created, new Date());
      expect(result.urgency).toBe('overdue');
      expect(result.label).toContain('overdue');
    });

    it('returns warning when <=25% left', () => {
      const now = new Date();
      // For critical (24h), 25% = 6h => 18h elapsed
      const created = new Date(now.getTime() - 19 * 3600 * 1000);
      const result = computeSLAStatus('critical', created, now);
      expect(result.urgency).toBe('warning');
    });

    it('returns critical when <=10% left', () => {
      const now = new Date();
      // For critical (24h), 10% = 2.4h => 22h elapsed
      const created = new Date(now.getTime() - 23 * 3600 * 1000);
      const result = computeSLAStatus('critical', created, now);
      expect(result.urgency).toBe('critical');
    });
  });

  describe('caseComparator', () => {
    const caseA = { priority: 'high', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02') };
    const caseB = { priority: 'low', createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-02-02') };

    it('sorts by priority ascending', () => {
      const cmp = caseComparator('priority', 'asc');
      expect(cmp(caseA, caseB)).toBeLessThan(0);
    });

    it('sorts by created ascending', () => {
      const cmp = caseComparator('created', 'asc');
      expect(cmp(caseA, caseB)).toBeLessThan(0);
    });

    it('sorts by updated descending', () => {
      const cmp = caseComparator('updated', 'desc');
      expect(cmp(caseA, caseB)).toBeGreaterThan(0);
    });
  });

  describe('matchShortcut', () => {
    it('matches alt+1 to tab:assigned', () => {
      const action = matchShortcut({ key: '1', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false });
      expect(action).toBe('tab:assigned');
    });

    it('matches ctrl+f to search:focus', () => {
      const action = matchShortcut({ key: 'f', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false });
      expect(action).toBe('search:focus');
    });

    it('matches Escape to ui:dismiss', () => {
      const action = matchShortcut({ key: 'Escape', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
      expect(action).toBe('ui:dismiss');
    });

    it('returns null for unmatched key', () => {
      const action = matchShortcut({ key: 'z', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
      expect(action).toBeNull();
    });
  });

  describe('constants', () => {
    it('SLA_HOURS has expected priorities', () => {
      expect(SLA_HOURS.critical).toBe(24);
      expect(SLA_HOURS.low).toBe(168);
    });

    it('EMPTY_STATES covers known tabs', () => {
      expect(EMPTY_STATES.assigned).toBeDefined();
      expect(EMPTY_STATES.overdue).toBeDefined();
    });

    it('WORKBENCH_SHORTCUTS is non-empty', () => {
      expect(WORKBENCH_SHORTCUTS.length).toBeGreaterThan(0);
    });
  });
});
