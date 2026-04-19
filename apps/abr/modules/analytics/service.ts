import type { AnalyticsSnapshot } from './types';

export function getAnalyticsSnapshot(orgId: string): AnalyticsSnapshot {
  return {
    orgId,
    reportingPeriod: 'Q1 2026',
    openIncidents: 7,
    overdueActions: 2,
    trainingCompletionRate: 84,
    confidenceBand: 'medium',
  };
}
