/**
 * Tests for workbench UX utilities — PR-052
 *
 * Validates SLA countdown, sort helpers, empty states, and keyboard shortcuts.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors
// ---------------------------------------------------------------------------

interface SLAStatus { label: string; remainingHours: number; urgency: 'ok' | 'warning' | 'critical' | 'overdue'; }
const SLA_HOURS: Record<string, number> = { critical: 24, high: 48, medium: 72, low: 168 };

function computeSLAStatus(priority: string, createdAt: Date, now: Date = new Date()): SLAStatus {
  const limitHours = SLA_HOURS[priority] ?? SLA_HOURS.low;
  const elapsedMs = now.getTime() - createdAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const remainingHours = Math.max(0, limitHours - elapsedHours);
  let urgency: SLAStatus['urgency'];
  if (remainingHours <= 0) urgency = 'overdue';
  else if (remainingHours <= limitHours * 0.1) urgency = 'critical';
  else if (remainingHours <= limitHours * 0.25) urgency = 'warning';
  else urgency = 'ok';
  let label: string;
  if (urgency === 'overdue') {
    const overdueHours = Math.abs(Math.round(limitHours - elapsedHours));
    label = overdueHours >= 24 ? `${Math.floor(overdueHours / 24)}d overdue` : `${overdueHours}h overdue`;
  } else if (remainingHours >= 24) {
    label = `${Math.floor(remainingHours / 24)}d ${Math.round(remainingHours % 24)}h left`;
  } else {
    label = `${Math.round(remainingHours)}h left`;
  }
  return { label, remainingHours: Math.round(remainingHours * 100) / 100, urgency };
}

type SortField = 'priority' | 'created' | 'updated' | 'sla';
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function caseComparator(field: SortField, direction: 'asc' | 'desc' = 'asc') {
  const dir = direction === 'asc' ? 1 : -1;
  return (a: { priority: string; createdAt: Date; updatedAt?: Date }, b: { priority: string; createdAt: Date; updatedAt?: Date }) => {
    switch (field) {
      case 'priority': return dir * ((PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      case 'created': return dir * (a.createdAt.getTime() - b.createdAt.getTime());
      case 'updated': return dir * ((a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0));
      default: return 0;
    }
  };
}

const EMPTY_STATES: Record<string, { title: string; description: string }> = {
  assigned: { title: 'No cases assigned to you', description: 'When a steward assigns a case to you, it will appear here.' },
  unassigned: { title: 'No unassigned cases', description: 'All cases have been assigned. Check back later.' },
  urgent: { title: 'No urgent cases', description: 'No critical or escalated cases at this time.' },
  overdue: { title: 'No overdue cases', description: 'All cases are within their SLA thresholds. Great work!' },
  recent: { title: 'No recent activity', description: 'No cases have been updated in the last 24 hours.' },
};

interface KeyboardShortcut { key: string; modifier?: string; description: string; action: string; }
const WORKBENCH_SHORTCUTS: KeyboardShortcut[] = [
  { key: '1', modifier: 'alt', description: 'Switch to Assigned tab', action: 'tab:assigned' },
  { key: 'n', modifier: 'alt', description: 'New case', action: 'case:new' },
  { key: 'f', modifier: 'ctrl', description: 'Focus search', action: 'search:focus' },
  { key: 'Escape', description: 'Close modal', action: 'ui:dismiss' },
];

function matchShortcut(event: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): string | null {
  for (const s of WORKBENCH_SHORTCUTS) {
    if (s.key.toLowerCase() !== event.key.toLowerCase()) continue;
    const mod = s.modifier;
    if (mod === 'ctrl' && !event.ctrlKey) continue;
    if (mod === 'alt' && !event.altKey) continue;
    if (mod === 'shift' && !event.shiftKey) continue;
    if (mod === 'meta' && !event.metaKey) continue;
    if (!mod && (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)) continue;
    return s.action;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SLA Status', () => {
  const NOW = new Date('2025-06-15T12:00:00Z');

  it('returns "ok" when plenty of time remains', () => {
    const createdAt = new Date('2025-06-15T00:00:00Z'); // 12 hours for medium (72h limit)
    const status = computeSLAStatus('medium', createdAt, NOW);
    expect(status.urgency).toBe('ok');
    expect(status.remainingHours).toBeGreaterThan(0);
  });

  it('returns "warning" when ≤25% time remains', () => {
    // critical: 24h limit, 20h elapsed → 4h remaining → 4/24 = 16.7% < 25%
    const createdAt = new Date('2025-06-14T16:00:00Z');
    const status = computeSLAStatus('critical', createdAt, NOW);
    expect(status.urgency).toBe('warning');
  });

  it('returns "critical" when ≤10% time remains', () => {
    // critical: 24h limit, 23h elapsed → 1h remaining → 1/24 = 4.2% < 10%
    const createdAt = new Date('2025-06-14T13:00:00Z');
    const status = computeSLAStatus('critical', createdAt, NOW);
    expect(status.urgency).toBe('critical');
  });

  it('returns "overdue" when time expired', () => {
    const createdAt = new Date('2025-06-13T00:00:00Z'); // 60h for critical (24h limit)
    const status = computeSLAStatus('critical', createdAt, NOW);
    expect(status.urgency).toBe('overdue');
    expect(status.remainingHours).toBe(0);
  });

  it('label shows days for overdue > 24h', () => {
    const createdAt = new Date('2025-06-12T00:00:00Z'); // 84h for critical (24h), 60h over
    const status = computeSLAStatus('critical', createdAt, NOW);
    expect(status.label).toContain('d overdue');
  });

  it('label shows hours for short remaining time', () => {
    const createdAt = new Date('2025-06-14T16:00:00Z'); // 20h elapsed for critical → 4h left
    const status = computeSLAStatus('critical', createdAt, NOW);
    expect(status.label).toContain('h left');
  });

  it('uses low SLA for unknown priority', () => {
    const status = computeSLAStatus('unknown', new Date('2025-06-15T00:00:00Z'), NOW);
    expect(status.urgency).toBe('ok');
    expect(status.remainingHours).toBeGreaterThan(100); // 168 - 12 = 156
  });
});

describe('Case Comparator', () => {
  it('sorts by priority ascending', () => {
    const cases = [
      { priority: 'low', createdAt: new Date() },
      { priority: 'critical', createdAt: new Date() },
      { priority: 'medium', createdAt: new Date() },
    ];
    cases.sort(caseComparator('priority', 'asc'));
    expect(cases[0].priority).toBe('critical');
    expect(cases[2].priority).toBe('low');
  });

  it('sorts by priority descending', () => {
    const cases = [
      { priority: 'critical', createdAt: new Date() },
      { priority: 'low', createdAt: new Date() },
    ];
    cases.sort(caseComparator('priority', 'desc'));
    expect(cases[0].priority).toBe('low');
  });

  it('sorts by created date', () => {
    const cases = [
      { priority: 'medium', createdAt: new Date('2025-06-15') },
      { priority: 'medium', createdAt: new Date('2025-06-10') },
    ];
    cases.sort(caseComparator('created', 'asc'));
    expect(cases[0].createdAt.getTime()).toBeLessThan(cases[1].createdAt.getTime());
  });

  it('sorts by updated date', () => {
    const cases = [
      { priority: 'medium', createdAt: new Date(), updatedAt: new Date('2025-06-15') },
      { priority: 'medium', createdAt: new Date(), updatedAt: new Date('2025-06-10') },
    ];
    cases.sort(caseComparator('updated', 'desc'));
    expect(cases[0].updatedAt!.getTime()).toBeGreaterThan(cases[1].updatedAt!.getTime());
  });
});

describe('Empty States', () => {
  it('has entries for all 5 queue tabs', () => {
    expect(Object.keys(EMPTY_STATES)).toEqual(['assigned', 'unassigned', 'urgent', 'overdue', 'recent']);
  });

  it('each entry has title and description', () => {
    for (const [, state] of Object.entries(EMPTY_STATES)) {
      expect(state.title).toBeTruthy();
      expect(state.description).toBeTruthy();
    }
  });
});

describe('Keyboard Shortcuts', () => {
  it('matches Alt+1 to tab:assigned', () => {
    const action = matchShortcut({ key: '1', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false });
    expect(action).toBe('tab:assigned');
  });

  it('matches Ctrl+F to search:focus', () => {
    const action = matchShortcut({ key: 'f', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false });
    expect(action).toBe('search:focus');
  });

  it('matches Escape (no modifier) to ui:dismiss', () => {
    const action = matchShortcut({ key: 'Escape', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
    expect(action).toBe('ui:dismiss');
  });

  it('returns null for unmatched key', () => {
    const action = matchShortcut({ key: 'z', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false });
    expect(action).toBeNull();
  });

  it('does not match shortcut with wrong modifier', () => {
    const action = matchShortcut({ key: 'n', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false });
    expect(action).toBeNull(); // should be alt+n, not ctrl+n
  });
});
