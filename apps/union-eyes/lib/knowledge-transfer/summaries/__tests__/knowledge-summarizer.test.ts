import { describe, expect, it, vi } from 'vitest';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  buildOrgAiTrace: () => ({}),
  toGatewayDataClass: (dataClass: string) => dataClass,
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
    consentGranted: true,
    sensitivityLevel: 'restricted',
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

  // DEF-0B7-EXC-SUMMARIZE-STORES-UNVALIDATED-OR-PLACEHOLDER-OUTPUT-AS-GENERATED and
  // DEF-0B7-EXC-SUMMARIZE-SENDS-ANY-CONSENT-STATE-TO-MODEL-AS-INTERNAL.
  it('fails, rather than returning a placeholder summary, when the provider returns something that is not a summary', async () => {
    for (const content of ['not json', '{}', JSON.stringify({ operationalSummary: '   ' }), JSON.stringify({ operationalSummary: 7 })]) {
      generateMock.mockResolvedValue({ content });
      await expect(generateKnowledgeSummary(interview())).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
    }
  });

  it('sends nothing to the provider unless the retiring employee consented', async () => {
    generateMock.mockClear();
    for (const consentGranted of [false, null, undefined]) {
      await expect(generateKnowledgeSummary(interview({ consentGranted }))).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('classifies the data by the interview sensitivity: internal only at the open levels', async () => {
    generateMock.mockResolvedValue({ content: JSON.stringify({ operationalSummary: 'sum' }) });
    for (const [level, expected] of [['public_internal', 'internal'], ['restricted', 'internal'], ['privileged', 'confidential'], ['legal_sensitive', 'confidential']]) {
      generateMock.mockClear();
      await generateKnowledgeSummary(interview({ sensitivityLevel: level }));
      expect(generateMock.mock.calls[0][0].dataClass).toBe(expected);
    }
  });
});