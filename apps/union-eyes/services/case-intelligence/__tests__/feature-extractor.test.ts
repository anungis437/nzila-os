import { describe, expect, it } from 'vitest';

import { extractFeatures } from '../feature-extractor';
import type { CaseSnapshot, DocumentCandidate } from '../types';

function makeCase(overrides: Partial<CaseSnapshot> = {}): CaseSnapshot {
  return {
    id: 'case-1',
    title: 'Grievance',
    description: 'Description',
    organizationId: 'org-1',
    grievantId: 'member-1',
    cbaId: 'cba-1',
    employerId: 'employer-1',
    workplaceId: 'worksite-1',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<DocumentCandidate> = {}): DocumentCandidate {
  return {
    id: 'doc-1',
    title: 'Doc',
    filename: 'doc.pdf',
    name: 'doc.pdf',
    privacyLabel: 'internal',
    documentType: 'evidence',
    fileUrl: 'https://example.test/doc.pdf',
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    linkedEntityType: null,
    linkedEntityId: null,
    tags: null,
    uploadedBy: null,
    ...overrides,
  };
}

describe('case-intelligence/feature-extractor', () => {
  it('flags every matching dimension when entities align', () => {
    const features = extractFeatures({
      currentCase: makeCase(),
      candidate: makeCandidate({
        linkedEntityType: 'member',
        linkedEntityId: 'member-1',
        tags: ['Safety', 'overtime'],
        uploadedBy: 'lro-1',
      }),
      sameCase: true,
      sameDocumentType: true,
      directTags: new Set(['safety']),
      assignedLroIds: new Set(['lro-1']),
      semanticSimilarity: 0.8,
      patternSimilarity: 0.6,
      usedInSimilarCase: true,
      isTemplateCandidate: true,
    });

    expect(features.sameCase).toBe(true);
    expect(features.sameMember).toBe(true);
    expect(features.sameDocumentType).toBe(true);
    expect(features.recentAccessByLRO).toBe(true);
    expect(features.sharedTags).toBe(1);
    expect(features.semanticSimilarity).toBe(0.8);
    expect(features.patternSimilarity).toBe(0.6);
    expect(features.usedInSimilarCase).toBe(true);
    expect(features.isTemplateCandidate).toBe(true);
  });

  it('matches agreement, employer, and worksite links', () => {
    const agreement = extractFeatures({
      currentCase: makeCase(),
      candidate: makeCandidate({ linkedEntityType: 'collective_agreement', linkedEntityId: 'cba-1' }),
      sameCase: false,
      sameDocumentType: false,
      directTags: new Set(),
      assignedLroIds: new Set(),
    });
    expect(agreement.sameAgreement).toBe(true);

    const employer = extractFeatures({
      currentCase: makeCase(),
      candidate: makeCandidate({ linkedEntityType: 'employer', linkedEntityId: 'employer-1' }),
      sameCase: false,
      sameDocumentType: false,
      directTags: new Set(),
      assignedLroIds: new Set(),
    });
    expect(employer.sameEmployer).toBe(true);

    const worksite = extractFeatures({
      currentCase: makeCase(),
      candidate: makeCandidate({ linkedEntityType: 'worksite', linkedEntityId: 'worksite-1' }),
      sameCase: false,
      sameDocumentType: false,
      directTags: new Set(),
      assignedLroIds: new Set(),
    });
    expect(worksite.sameWorksite).toBe(true);
  });

  it('defaults optional signals and reports no matches when nothing aligns', () => {
    const features = extractFeatures({
      currentCase: makeCase({ grievantId: null, cbaId: null, employerId: null, workplaceId: null }),
      candidate: makeCandidate(),
      sameCase: false,
      sameDocumentType: false,
      directTags: new Set(),
      assignedLroIds: new Set(),
    });

    expect(features.sameMember).toBe(false);
    expect(features.sameAgreement).toBe(false);
    expect(features.sameEmployer).toBe(false);
    expect(features.sameWorksite).toBe(false);
    expect(features.sharedTags).toBe(0);
    expect(features.recentAccessByLRO).toBe(false);
    expect(features.semanticSimilarity).toBe(0);
    expect(features.patternSimilarity).toBe(0);
    expect(features.usedInSimilarCase).toBe(false);
    expect(features.isTemplateCandidate).toBe(false);
  });
});
