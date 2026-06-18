import { describe, expect, it, vi } from 'vitest';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  buildOrgAiTrace: () => ({}),
  UE_APP_KEY: 'ue',
  UE_SYSTEM_ORG_ID: 'sys',
  UE_PROFILES: { EXPERTISE_EXTRACTION: 'ee' },
}));

import { extractExpertise, flattenExpertiseTags } from '../expertise-extractor';

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

  it('falls back to safe profile on invalid JSON and minimal interview', async () => {
    generateMock.mockResolvedValue({ content: 'bad' });
    const profile = await extractExpertise(
      interview({ keyLessons: null, bestPractices: null, bargainingAdvice: null, mediationAdvice: null, incomingOfficerAdvice: null, topics: undefined, organizationId: 123 }),
    );
    expect(profile.continuitySensitivity).toBe('medium');
    expect(profile.continuityJustification).toContain('manual review');
    expect(profile.expertiseDomains).toEqual([]);
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
