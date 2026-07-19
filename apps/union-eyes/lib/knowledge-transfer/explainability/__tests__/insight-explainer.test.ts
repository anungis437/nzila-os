import { describe, expect, it, vi } from 'vitest';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate }),
  buildOrgAiTrace: (o: string) => ({ orgId: o }),
  UE_APP_KEY: 'ue', UE_SYSTEM_ORG_ID: 'sys',
  UE_PROFILES: { TOPIC_EXTRACTION: 'topic_extraction' },
}));

import { explainInsights } from '../insight-explainer';

const interviews = [
  { id: 'i1', title: 'Steward exit', roleInUnion: 'steward', topics: ['arbitration'], expertiseTags: ['grievances'] },
  { id: 'i2', title: 'Officer exit', roleInUnion: 'officer', topics: ['bargaining'], expertiseTags: ['finance'] },
];

describe('lib/knowledge-transfer/explainability/insight-explainer', () => {
  it('returns empty report when no insights', async () => {
    const report = await explainInsights({ orgId: 'org-1', insights: [], sourceInterviews: interviews });
    expect(report.insights).toEqual([]);
    expect(report.reviewStatus).toBe('unreviewed');
    expect(generate).not.toHaveBeenCalled();
  });

  it('explains insights with parsed AI output and evidence refs', async () => {
    generate.mockResolvedValue({
      content: JSON.stringify([
        { humanReadable: 'Concentration observed', reasoning: 'Pattern across interviews', supportingPatterns: ['p1', 'p2'], confidenceLevel: 'high', recommendation: 'Cross-train' },
      ]),
    });
    const report = await explainInsights({
      orgId: 'org-1',
      insights: [{ type: 'expertise_concentration', description: 'Concentration', relatedTopics: ['arbitration'], affectedRoles: ['steward'] }],
      sourceInterviews: interviews,
    });
    expect(report.insights.length).toBe(1);
    expect(report.insights[0].humanReadable).toBe('Concentration observed');
    expect(report.insights[0].confidenceLevel).toBe('high');
    expect(report.insights[0].evidenceRefs.length).toBeGreaterThan(0);
  });

  it('falls back when AI returns invalid JSON', async () => {
    generate.mockResolvedValue({ content: 'not json' });
    const report = await explainInsights({
      orgId: 'org-2',
      insights: [{ type: 'coverage_gap', description: 'Gap', relatedTopics: ['bargaining'], affectedRoles: ['officer'] }],
      sourceInterviews: interviews,
    });
    expect(report.insights[0].confidenceLevel).toBe('medium');
    expect(report.insights[0].insightType).toBe('coverage_gap');
  });
});
