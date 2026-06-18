import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbQueryClaims: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  dbQuerySharedClauseLibrary: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      claims: mocks.dbQueryClaims,
      sharedClauseLibrary: mocks.dbQuerySharedClauseLibrary,
    },
  },
}));

vi.mock('@/db/schema', () => ({
  claims: {
    claimId: 'claimId', organizationId: 'organizationId',
    claimType: 'claimType', status: 'status', resolvedAt: 'resolvedAt',
  },
  sharedClauseLibrary: { sourceOrganizationId: 'sourceOrganizationId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  desc: vi.fn((a: any) => a),
  sql: vi.fn(),
  inArray: vi.fn((...a: any[]) => a),
  relations: vi.fn(() => ({})),
}));

import { generateSettlementRecommendation } from '../settlement-recommendation-engine';

describe('settlement-recommendation-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when claim not found', async () => {
    mocks.dbQueryClaims.findFirst.mockResolvedValue(null);

    const result = await generateSettlementRecommendation('claim-1', 'org-1');
    expect(result).toBeNull();
  });

  it('generates recommendation for valid claim', async () => {
    const claim = {
      claimId: 'claim-1',
      organizationId: 'org-1',
      claimType: 'grievance',
      priority: 'medium',
      department: 'ops',
      description: 'unfair scheduling practice',
      metadata: { complexity: 5, evidenceStrength: 7 },
      filedAt: '2026-01-10',
      incidentDate: '2026-01-05',
      resolutionOutcome: null,
    };

    const pastClaims = [
      {
        claimId: 'past-1',
        claimType: 'grievance',
        priority: 'medium',
        department: 'ops',
        description: 'unfair scheduling',
        metadata: {},
        filedDate: '2025-06-01',
        resolvedAt: '2025-06-20',
        resolutionOutcome: 'favorable',
        status: 'resolved',
      },
    ];

    mocks.dbQueryClaims.findFirst.mockResolvedValue(claim);
    mocks.dbQueryClaims.findMany.mockResolvedValue(pastClaims);
    mocks.dbQuerySharedClauseLibrary.findMany.mockResolvedValue([]);

    const result = await generateSettlementRecommendation('claim-1', 'org-1');

    expect(result).not.toBeNull();
    expect(result!.claimId).toBe('claim-1');
    expect(result!.recommendedOutcome).toBeDefined();
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.riskLevel).toBeDefined();
    expect(result!.suggestedActions).toBeInstanceOf(Array);
  });

  it('returns null on database error', async () => {
    mocks.dbQueryClaims.findFirst.mockRejectedValue(new Error('DB down'));

    const result = await generateSettlementRecommendation('claim-1', 'org-1');
    expect(result).toBeNull();
  });

  it('handles claim with no precedents', async () => {
    const claim = {
      claimId: 'claim-2',
      organizationId: 'org-1',
      claimType: 'safety',
      priority: 'high',
      description: 'chemical exposure incident',
      metadata: {},
    };

    mocks.dbQueryClaims.findFirst.mockResolvedValue(claim);
    mocks.dbQueryClaims.findMany.mockResolvedValue([]);
    mocks.dbQuerySharedClauseLibrary.findMany.mockResolvedValue([]);

    const result = await generateSettlementRecommendation('claim-2', 'org-1');
    expect(result).not.toBeNull();
    expect(result!.similarPrecedents).toHaveLength(0);
  });
});
