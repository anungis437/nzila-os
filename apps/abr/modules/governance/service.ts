import type { GovernancePackSummary, GovernancePersonaView } from './types';

export function getGovernancePackSummary(orgId: string): GovernancePackSummary {
  return {
    orgId,
    generatedAt: new Date().toISOString(),
    boardReadiness: 'needs_review',
    unresolvedCriticalRisks: 1,
    pendingExecutiveActions: 3,
  };
}

export function listGovernancePersonaViews(): GovernancePersonaView[] {
  return [
    {
      persona: 'CHRO',
      headline: 'Workforce accountability requires faster remediation closure and manager certification coverage.',
      metrics: [
        { label: 'Unresolved serious matters', value: '4', note: '2 need executive check-ins this week' },
        { label: 'Completion gaps', value: '16%', note: 'Manager cohort below target' },
        { label: 'Remediation aging', value: '21 days', note: 'Median age for open actions' },
      ],
    },
    {
      persona: 'CEO/COO',
      headline: 'Enterprise exposure is concentrated in two operational hotspots and one governance lag.',
      metrics: [
        { label: 'Enterprise risk summary', value: 'Moderate-High', note: 'Escalating in hiring and promotion streams' },
        { label: 'Trend trajectory', value: '+14%', note: 'Comparator matters up over prior quarter' },
        { label: 'Policy risk zones', value: '3', note: 'Requires owner-confirmed remediation' },
      ],
    },
    {
      persona: 'Board',
      headline: 'Board oversight should focus on overdue actions, repeat sectors, and proof of follow-through.',
      metrics: [
        { label: 'Quarterly summary', value: '7 open matters', note: '2 closed this quarter' },
        { label: 'Actions overdue', value: '2', note: 'Both tied to policy review commitments' },
        { label: 'Prior-quarter benchmark', value: '+1 hotspot', note: 'Promotion trend worsened quarter-over-quarter' },
      ],
    },
    {
      persona: 'Public Sector',
      headline: 'Compliance posture is strengthening, but closure performance still lags public accountability expectations.',
      metrics: [
        { label: 'Compliance lens', value: 'Needs review', note: 'Monitoring and report-back evidence incomplete' },
        { label: 'Training status', value: '84%', note: 'Frontline manager recertification still open' },
        { label: 'Closure performance', value: '32 days', note: 'Average above target by 6 days' },
      ],
    },
  ];
}
