import { describe, expect, it, vi } from 'vitest';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  buildOrgAiTrace: () => ({}),
  UE_APP_KEY: 'ue',
  UE_SYSTEM_ORG_ID: 'sys',
  UE_PROFILES: { EXPERTISE_EXTRACTION: 'ee' },
}));

import { ExpertiseExtractionError, extractExpertise, flattenExpertiseTags } from '../expertise-extractor';

function interview(extra: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    organizationId: 'org-1',
    roleInUnion: 'officer',
    yearsOfService: 10,
    title: 'Exit',
    keyLessons: 'kl',
    bestPractices: 'bp',
    bargainingAdvice: 'ba',
    mediationAdvice: 'ma',
    incomingOfficerAdvice: 'ioa',
    topics: ['WSIB', 'Bargaining'],
    ...extra,
  } as never;
}

describe('lib/knowledge-transfer/expertise/expertise-extractor', () => {
  it('parses AI JSON into an expertise profile', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        expertiseDomains: ['WSIB claims'],
        systemsOwnership: ['HRIS'],
        vendorRelationships: ['Insurer'],
        undocumentedWorkflows: [],
        complianceAreas: ['OHSA'],
        governanceObligations: ['Board'],
        crossTeamDependencies: ['Payroll'],
        continuitySensitivity: 'high',
        continuityJustification: 'critical role',
      }),
    });
    const profile = await extractExpertise(interview());
    expect(profile.expertiseDomains).toEqual(['WSIB claims']);
    expect(profile.continuitySensitivity).toBe('high');
    expect(profile.sourceInterviewId).toBe('i1');
  });

  // Replaced: this test asserted that an unparseable model answer became a default "medium" profile, which stored a guess as an assessment.
  it('refuses an unparseable model answer instead of inventing a medium-risk profile', async () => {
    generateMock.mockResolvedValue({ content: 'bad' });
    await expect(extractExpertise(
      interview({ keyLessons: null, bestPractices: null, bargainingAdvice: null, mediationAdvice: null, incomingOfficerAdvice: null, topics: undefined, organizationId: 123 }),
    )).rejects.toBeInstanceOf(ExpertiseExtractionError);
  });

  it('refuses a model answer with no valid sensitivity or with a non-list field', async () => {
    generateMock.mockResolvedValue({ content: JSON.stringify({ expertiseDomains: ['x'] }) });
    await expect(extractExpertise(interview())).rejects.toThrow(/sensitivity/);
    generateMock.mockResolvedValue({ content: JSON.stringify({ continuitySensitivity: 'low', systemsOwnership: 'HRIS' }) });
    await expect(extractExpertise(interview())).rejects.toThrow(/systemsOwnership/);
  });

  it('flattenExpertiseTags dedupes and lowercases', () => {
    const tags = flattenExpertiseTags({
      expertiseDomains: ['WSIB', 'wsib '],
      systemsOwnership: ['HRIS'],
      vendorRelationships: [''],
      undocumentedWorkflows: ['ignored'],
      complianceAreas: ['OHSA'],
      governanceObligations: ['Board'],
      continuitySensitivity: 'low',
      continuityJustification: 'j',
      sourceInterviewId: 'i1',
    });
    expect(tags).toContain('wsib');
    expect(tags).toContain('hris');
    expect(tags.filter((t) => t === 'wsib').length).toBe(1);
    expect(tags).not.toContain('ignored');
    expect(tags).not.toContain('');
  });
});
