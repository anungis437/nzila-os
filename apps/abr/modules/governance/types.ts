export interface GovernancePackSummary {
  orgId: string;
  generatedAt: string;
  boardReadiness: 'not_ready' | 'needs_review' | 'ready';
  unresolvedCriticalRisks: number;
  pendingExecutiveActions: number;
}

export interface GovernancePersonaView {
  persona: 'CHRO' | 'CEO/COO' | 'Board' | 'Public Sector';
  headline: string;
  metrics: Array<{ label: string; value: string; note: string }>;
}
