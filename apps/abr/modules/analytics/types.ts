export interface AnalyticsSnapshot {
  orgId: string;
  reportingPeriod: string;
  openIncidents: number;
  overdueActions: number;
  trainingCompletionRate: number;
  confidenceBand: 'low' | 'medium' | 'high';
}
