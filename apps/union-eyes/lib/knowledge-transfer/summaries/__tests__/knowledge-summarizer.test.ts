import { describe, expect, it, vi } from 'vitest';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  buildOrgAiTrace: () => ({}),
  UE_APP_KEY: 'ue',
  UE_SYSTEM_ORG_ID: 'sys',
  UE_PROFILES: { KNOWLEDGE_SUMMARY: 'ks' },
}));

import { generateKnowledgeSummary } from '../knowledge-summarizer';

function interview(extra: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    organizationId: 'org-1',
    roleInUnion: 'steward',
    yearsOfService: 7,
    title: 'Exit',
    keyLessons: 'lesson',
    bestPractices: 'bp',
    bargainingAdvice: 'ba',
    mediationAdvice: 'ma',
    incomingOfficerAdvice: 'ioa',
    ...extra,
  } as never;
}

describe('lib/knowledge-transfer/summaries/knowledge-summarizer', () => {
  it('parses AI JSON into a summary with all optional fields', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        operationalSummary: 'sum',
        handoffPoints: ['h1'],
        recurringThemes: ['t1'],
        continuityRecommendations: ['r1'],
      }),
    });
    const result = await generateKnowledgeSummary(interview());
    expect(result.operationalSummary).toBe('sum');
    expect(result.handoffPoints).toEqual(['h1']);
    expect(result.sourceInterviewId).toBe('i1');
    expect(result.generatedAt).toBeDefined();
  });

  it('falls back gracefully on invalid JSON and minimal interview', async () => {
    generateMock.mockResolvedValue({ content: 'not json' });
    const result = await generateKnowledgeSummary(
      interview({ keyLessons: null, bestPractices: null, bargainingAdvice: null, mediationAdvice: null, incomingOfficerAdvice: null, organizationId: undefined }),
    );
    expect(result.operationalSummary).toContain('Manual review');
    expect(result.handoffPoints).toEqual([]);
    expect(result.sourceInterviewId).toBe('i1');
  });
});
