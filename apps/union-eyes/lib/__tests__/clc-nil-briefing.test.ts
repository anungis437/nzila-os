/**
 * Unit Tests — CLC NIL Briefing Service
 *
 * Validates rule-based intelligence briefing generators
 * for all four CLC data product dimensions.
 */
import { describe, it, expect } from 'vitest';
import {
  generateSectorSignalsBriefing,
  generateAffiliateEngagementBriefing,
  generateKnowledgeIndexBriefing,
  generateGovernanceBriefing,
  type IntelligenceBriefing,
} from '@/lib/clc/nil-briefing';
import type { SectorSignal, AffiliateTrend, SharedKnowledgeIndex, GovernanceSummary } from '@/lib/clc/data-products';

// ── Helpers ─────────────────────────────────────────────────────────────────

function expectValidBriefing(briefing: IntelligenceBriefing): void {
  expect(briefing.useCase).toBeTruthy();
  expect(briefing.generatedAt).toBeTruthy();
  expect(briefing.overallConfidence).toBeGreaterThanOrEqual(0);
  expect(briefing.overallConfidence).toBeLessThanOrEqual(1);
  expect(briefing.findings).toBeInstanceOf(Array);
  expect(briefing.promptContract).toBeTruthy();
}

function makeSectorSignal(overrides: Partial<SectorSignal> = {}): SectorSignal {
  return {
    sector: 'Healthcare',
    clauseCount: 20,
    precedentCount: 5,
    totalCitations: 30,
    totalViews: 100,
    uniqueOrgs: 4,
    topClauseTypes: [{ clauseType: 'wages', count: 12 }],
    ...overrides,
  };
}

function makeAffiliateTrend(overrides: Partial<AffiliateTrend> = {}): AffiliateTrend {
  return {
    organizationType: 'local',
    affiliateCount: 10,
    clausesShared: 15,
    precedentsShared: 8,
    accessesInitiated: 20,
    resourcesAccessed: 12,
    clauseSharingEnabledCount: 8,
    precedentSharingEnabledCount: 6,
    ...overrides,
  };
}

function makeKnowledgeIndex(overrides: Partial<SharedKnowledgeIndex> = {}): SharedKnowledgeIndex {
  return {
    totalClauses: 200,
    totalPrecedents: 50,
    totalCitations: 120,
    totalViews: 800,
    uniqueOrgs: 8,
    topCited: [
      { id: 'c1', title: 'Wage parity clause', type: 'clause', citationCount: 15, sector: 'Healthcare' },
    ],
    clauseTypeDistribution: [{ name: 'wages', value: 80 }],
    outcomeDistribution: [{ name: 'upheld', value: 35 }],
    ...overrides,
  };
}

function makeGovernanceSummary(overrides: Partial<GovernanceSummary> = {}): GovernanceSummary {
  return {
    totalAffiliates: 20,
    consentedCrossUnion: 15,
    consentedSectorBenchmarks: 12,
    consentedNationalSignals: 18,
    sharingAdoption: {
      clauseSharingEnabled: 14,
      precedentSharingEnabled: 10,
      federationSharingEnabled: 8,
    },
    cohortHealth: 'healthy',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CLC NIL Briefing Service', () => {
  // ── Sector Signals ────────────────────────────────────────────────────

  describe('generateSectorSignalsBriefing', () => {
    it('produces valid briefing structure', () => {
      const briefing = generateSectorSignalsBriefing([makeSectorSignal()]);
      expectValidBriefing(briefing);
      expect(briefing.useCase).toBe('clc.sector-signals-briefing');
    });

    it('reports insufficient data for empty signals', () => {
      const briefing = generateSectorSignalsBriefing([]);
      expect(briefing.findings).toHaveLength(1);
      expect(briefing.findings[0]!.severity).toBe('advisory');
      expect(briefing.findings[0]!.title).toContain('Insufficient');
    });

    it('identifies top clause sector', () => {
      const briefing = generateSectorSignalsBriefing([
        makeSectorSignal({ sector: 'Healthcare', clauseCount: 50 }),
        makeSectorSignal({ sector: 'Education', clauseCount: 10 }),
      ]);
      const topFinding = briefing.findings.find((f) => f.title.includes('Healthcare'));
      expect(topFinding).toBeDefined();
      expect(topFinding!.severity).toBe('info');
    });

    it('flags high precedent-to-clause ratio', () => {
      const briefing = generateSectorSignalsBriefing([
        makeSectorSignal({ sector: 'Mining', clauseCount: 5, precedentCount: 15 }),
      ]);
      const advisory = briefing.findings.find((f) => f.title.includes('precedent density'));
      expect(advisory).toBeDefined();
      expect(advisory!.severity).toBe('advisory');
    });

    it('reports cross-sector growth for 3+ sectors', () => {
      const briefing = generateSectorSignalsBriefing([
        makeSectorSignal({ sector: 'A' }),
        makeSectorSignal({ sector: 'B' }),
        makeSectorSignal({ sector: 'C' }),
      ]);
      const xSector = briefing.findings.find((f) => f.title.includes('Cross-sector'));
      expect(xSector).toBeDefined();
    });
  });

  // ── Affiliate Engagement ──────────────────────────────────────────────

  describe('generateAffiliateEngagementBriefing', () => {
    it('produces valid briefing structure', () => {
      const briefing = generateAffiliateEngagementBriefing([makeAffiliateTrend()]);
      expectValidBriefing(briefing);
      expect(briefing.useCase).toBe('clc.affiliate-engagement-summary');
    });

    it('reports no data for empty trends', () => {
      const briefing = generateAffiliateEngagementBriefing([]);
      expect(briefing.findings).toHaveLength(1);
      expect(briefing.findings[0]!.title).toContain('No affiliate');
    });

    it('calculates adoption rate', () => {
      const briefing = generateAffiliateEngagementBriefing([
        makeAffiliateTrend({ affiliateCount: 10, clauseSharingEnabledCount: 5, precedentSharingEnabledCount: 5 }),
      ]);
      const adoptionFinding = briefing.findings.find((f) => f.title.includes('adoption'));
      expect(adoptionFinding).toBeDefined();
      expect(adoptionFinding!.detail).toContain('50%');
    });

    it('flags zero-contribution org types', () => {
      const briefing = generateAffiliateEngagementBriefing([
        makeAffiliateTrend({ organizationType: 'provincial', affiliateCount: 5, clausesShared: 0, precedentsShared: 0 }),
      ]);
      const zeroCont = briefing.findings.find((f) => f.title.includes('zero contributions'));
      expect(zeroCont).toBeDefined();
      expect(zeroCont!.severity).toBe('advisory');
    });

    it('identifies most active org type', () => {
      const briefing = generateAffiliateEngagementBriefing([
        makeAffiliateTrend({ organizationType: 'local', clausesShared: 50, precedentsShared: 20 }),
        makeAffiliateTrend({ organizationType: 'national', clausesShared: 5, precedentsShared: 2 }),
      ]);
      const mostActive = briefing.findings.find((f) => f.title.includes('most active'));
      expect(mostActive).toBeDefined();
      expect(mostActive!.title).toContain('local');
    });

    it('flags low adoption rate as action-required', () => {
      const briefing = generateAffiliateEngagementBriefing([
        makeAffiliateTrend({ affiliateCount: 20, clauseSharingEnabledCount: 2, precedentSharingEnabledCount: 1 }),
      ]);
      const adoption = briefing.findings.find((f) => f.title.includes('adoption'));
      expect(adoption!.severity).toBe('action-required');
    });
  });

  // ── Knowledge Index ───────────────────────────────────────────────────

  describe('generateKnowledgeIndexBriefing', () => {
    it('produces valid briefing structure', () => {
      const briefing = generateKnowledgeIndexBriefing(makeKnowledgeIndex());
      expectValidBriefing(briefing);
      expect(briefing.useCase).toBe('clc.knowledge-index-summary');
    });

    it('includes knowledge base size finding', () => {
      const briefing = generateKnowledgeIndexBriefing(makeKnowledgeIndex({ totalClauses: 300, totalPrecedents: 75 }));
      const sizeFinding = briefing.findings.find((f) => f.title.includes('300 clauses'));
      expect(sizeFinding).toBeDefined();
    });

    it('reports most-cited resource', () => {
      const briefing = generateKnowledgeIndexBriefing(makeKnowledgeIndex());
      const citedFinding = briefing.findings.find((f) => f.title.includes('Most-cited'));
      expect(citedFinding).toBeDefined();
      expect(citedFinding!.detail).toContain('Wage parity clause');
    });

    it('flags low contributor diversity', () => {
      const briefing = generateKnowledgeIndexBriefing(makeKnowledgeIndex({ uniqueOrgs: 3 }));
      const lowDiv = briefing.findings.find((f) => f.title.includes('Low contributor'));
      expect(lowDiv).toBeDefined();
      expect(lowDiv!.severity).toBe('advisory');
    });

    it('does not flag diversity when sufficient contributors', () => {
      const briefing = generateKnowledgeIndexBriefing(makeKnowledgeIndex({ uniqueOrgs: 10 }));
      const lowDiv = briefing.findings.find((f) => f.title.includes('Low contributor'));
      expect(lowDiv).toBeUndefined();
    });
  });

  // ── Governance Health ─────────────────────────────────────────────────

  describe('generateGovernanceBriefing', () => {
    it('produces valid briefing structure', () => {
      const briefing = generateGovernanceBriefing(makeGovernanceSummary());
      expectValidBriefing(briefing);
      expect(briefing.useCase).toBe('clc.governance-health-briefing');
    });

    it('reports consent rates for all 3 dimensions', () => {
      const briefing = generateGovernanceBriefing(makeGovernanceSummary());
      const consentFindings = briefing.findings.filter((f) => f.title.includes('consent'));
      expect(consentFindings.length).toBeGreaterThanOrEqual(3);
    });

    it('flags low consent rate as advisory', () => {
      const briefing = generateGovernanceBriefing(
        makeGovernanceSummary({ totalAffiliates: 20, consentedSectorBenchmarks: 5 }),
      );
      const lowConsent = briefing.findings.find((f) =>
        f.title.includes('Sector Benchmarks') && f.severity === 'advisory',
      );
      expect(lowConsent).toBeDefined();
    });

    it('includes cohort health finding', () => {
      const briefing = generateGovernanceBriefing(makeGovernanceSummary({ cohortHealth: 'healthy' }));
      const healthFinding = briefing.findings.find((f) => f.title.includes('Cohort health'));
      expect(healthFinding).toBeDefined();
      expect(healthFinding!.title).toContain('healthy');
    });

    it('flags insufficient cohort as action-required', () => {
      const briefing = generateGovernanceBriefing(
        makeGovernanceSummary({ cohortHealth: 'insufficient' }),
      );
      const healthFinding = briefing.findings.find((f) => f.title.includes('Cohort health'));
      expect(healthFinding!.severity).toBe('action-required');
    });
  });

  // ── Briefing metadata ─────────────────────────────────────────────────

  describe('briefing metadata', () => {
    it('computes average confidence correctly', () => {
      const briefing = generateSectorSignalsBriefing([]);
      // Single finding with confidence 1.0 → overall = 1.0
      expect(briefing.overallConfidence).toBe(1.0);
    });

    it('sets promptContract to useCase', () => {
      const briefing = generateSectorSignalsBriefing([]);
      expect(briefing.promptContract).toBe(briefing.useCase);
    });

    it('generates ISO timestamp', () => {
      const briefing = generateSectorSignalsBriefing([]);
      expect(() => new Date(briefing.generatedAt).toISOString()).not.toThrow();
    });
  });
});
