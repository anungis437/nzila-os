export interface PipelineAccountRecord {
  id: string;
  organizationName: string;
  owner: string;
  stage: 'discovery' | 'demo' | 'proposal' | 'procurement' | 'closing';
  nextAction: string;
  nextActionDueAt: string;
  projectedValue: string;
  buyerChampion: string;
  crmStatus: 'on_track' | 'at_risk' | 'blocked';
}

export interface PipelineSummary {
  totalAccounts: number;
  activeDemos: number;
  procurementActive: number;
  projectedPipelineValue: string;
  overdueFollowUps: number;
}
