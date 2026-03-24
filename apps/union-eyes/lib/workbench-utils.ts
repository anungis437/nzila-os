/**
 * Workbench UX Polish — PR-052
 *
 * Utility helpers for the case workbench:
 * - SLA countdown / urgency classification
 * - Sort helpers for queue tabs
 * - Empty-state messages per queue tab
 * - Keyboard shortcut definitions
 */

// ---------------------------------------------------------------------------
// SLA Countdown
// ---------------------------------------------------------------------------

export interface SLAStatus {
  label: string;
  remainingHours: number;
  urgency: 'ok' | 'warning' | 'critical' | 'overdue';
}

/** SLA limits in hours by priority */
export const SLA_HOURS: Record<string, number> = {
  critical: 24,
  high: 48,
  medium: 72,
  low: 168,
};

/**
 * Calculate SLA status for a case.
 * Warning threshold: ≤25% of time remaining.
 * Critical threshold: ≤10% of time remaining.
 */
export function computeSLAStatus(
  priority: string,
  createdAt: Date,
  now: Date = new Date(),
): SLAStatus {
  const limitHours = SLA_HOURS[priority] ?? SLA_HOURS.low;
  const elapsedMs = now.getTime() - createdAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const remainingHours = Math.max(0, limitHours - elapsedHours);

  let urgency: SLAStatus['urgency'];
  if (remainingHours <= 0) {
    urgency = 'overdue';
  } else if (remainingHours <= limitHours * 0.1) {
    urgency = 'critical';
  } else if (remainingHours <= limitHours * 0.25) {
    urgency = 'warning';
  } else {
    urgency = 'ok';
  }

  let label: string;
  if (urgency === 'overdue') {
    const overdueHours = Math.abs(Math.round(limitHours - elapsedHours));
    label = overdueHours >= 24
      ? `${Math.floor(overdueHours / 24)}d overdue`
      : `${overdueHours}h overdue`;
  } else if (remainingHours >= 24) {
    label = `${Math.floor(remainingHours / 24)}d ${Math.round(remainingHours % 24)}h left`;
  } else {
    label = `${Math.round(remainingHours)}h left`;
  }

  return { label, remainingHours: Math.round(remainingHours * 100) / 100, urgency };
}

// ---------------------------------------------------------------------------
// Sort Helpers
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type SortField = 'priority' | 'created' | 'updated' | 'sla';

/**
 * Create a comparator for workbench case sorting.
 */
export function caseComparator(
  field: SortField,
  direction: 'asc' | 'desc' = 'asc',
): (a: { priority: string; createdAt: Date; updatedAt?: Date }, b: { priority: string; createdAt: Date; updatedAt?: Date }) => number {
  const dir = direction === 'asc' ? 1 : -1;

  return (a, b) => {
    switch (field) {
      case 'priority':
        return dir * ((PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      case 'created':
        return dir * (a.createdAt.getTime() - b.createdAt.getTime());
      case 'updated':
        return dir * ((a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0));
      case 'sla': {
        const slaA = SLA_HOURS[a.priority] ?? SLA_HOURS.low;
        const slaB = SLA_HOURS[b.priority] ?? SLA_HOURS.low;
        const remainA = slaA - (Date.now() - a.createdAt.getTime()) / 3600000;
        const remainB = slaB - (Date.now() - b.createdAt.getTime()) / 3600000;
        return dir * (remainA - remainB);
      }
      default:
        return 0;
    }
  };
}

// ---------------------------------------------------------------------------
// Empty State Messages
// ---------------------------------------------------------------------------

export const EMPTY_STATES: Record<string, { title: string; description: string }> = {
  assigned: {
    title: 'No cases assigned to you',
    description: 'When a steward assigns a case to you, it will appear here.',
  },
  unassigned: {
    title: 'No unassigned cases',
    description: 'All cases have been assigned. Check back later.',
  },
  urgent: {
    title: 'No urgent cases',
    description: 'No critical or escalated cases at this time.',
  },
  overdue: {
    title: 'No overdue cases',
    description: 'All cases are within their SLA thresholds. Great work!',
  },
  recent: {
    title: 'No recent activity',
    description: 'No cases have been updated in the last 24 hours.',
  },
};

// ---------------------------------------------------------------------------
// Keyboard Shortcuts
// ---------------------------------------------------------------------------

export interface KeyboardShortcut {
  key: string;
  modifier?: 'ctrl' | 'alt' | 'shift' | 'meta';
  description: string;
  action: string;
}

export const WORKBENCH_SHORTCUTS: KeyboardShortcut[] = [
  { key: '1', modifier: 'alt', description: 'Switch to Assigned tab', action: 'tab:assigned' },
  { key: '2', modifier: 'alt', description: 'Switch to Unassigned tab', action: 'tab:unassigned' },
  { key: '3', modifier: 'alt', description: 'Switch to Urgent tab', action: 'tab:urgent' },
  { key: '4', modifier: 'alt', description: 'Switch to Overdue tab', action: 'tab:overdue' },
  { key: '5', modifier: 'alt', description: 'Switch to Recent tab', action: 'tab:recent' },
  { key: 'n', modifier: 'alt', description: 'New case', action: 'case:new' },
  { key: 'f', modifier: 'ctrl', description: 'Focus search', action: 'search:focus' },
  { key: 'r', modifier: 'alt', description: 'Refresh queue', action: 'queue:refresh' },
  { key: 'Escape', description: 'Close modal / deselect', action: 'ui:dismiss' },
];

/**
 * Match a KeyboardEvent to a shortcut action.
 */
export function matchShortcut(
  event: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
): string | null {
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
