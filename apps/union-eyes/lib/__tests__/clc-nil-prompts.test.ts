/**
 * Unit Tests — CLC NIL Prompt Contracts
 *
 * Validates prompt use-case keys, shared preamble,
 * buildInput helpers, and system prompt content.
 */
import { describe, it, expect } from 'vitest';
import {
  CLC_ANALYST_PREAMBLE,
  SECTOR_SIGNALS_BRIEFING,
  AFFILIATE_ENGAGEMENT_SUMMARY,
  KNOWLEDGE_INDEX_SUMMARY,
  GOVERNANCE_HEALTH_BRIEFING,
  buildSectorSignalsInput,
  buildAffiliateEngagementInput,
  buildKnowledgeIndexInput,
  buildGovernanceHealthInput,
} from '@/lib/clc/nil-prompts';

describe('CLC NIL Prompt Contracts', () => {
  // ── Preamble ──────────────────────────────────────────────────────────

  describe('CLC_ANALYST_PREAMBLE', () => {
    it('exists and contains analyst persona', () => {
      expect(CLC_ANALYST_PREAMBLE).toBeTruthy();
      expect(CLC_ANALYST_PREAMBLE).toContain('labour');
    });
  });

  // ── Contracts ─────────────────────────────────────────────────────────

  const allContracts = [
    { name: 'SECTOR_SIGNALS_BRIEFING', contract: SECTOR_SIGNALS_BRIEFING, useCase: 'clc.sector-signals-briefing' },
    { name: 'AFFILIATE_ENGAGEMENT_SUMMARY', contract: AFFILIATE_ENGAGEMENT_SUMMARY, useCase: 'clc.affiliate-engagement-summary' },
    { name: 'KNOWLEDGE_INDEX_SUMMARY', contract: KNOWLEDGE_INDEX_SUMMARY, useCase: 'clc.knowledge-index-summary' },
    { name: 'GOVERNANCE_HEALTH_BRIEFING', contract: GOVERNANCE_HEALTH_BRIEFING, useCase: 'clc.governance-health-briefing' },
  ];

  describe.each(allContracts)('$name', ({ contract, useCase }) => {
    it(`has useCase "${useCase}"`, () => {
      expect(contract.useCase).toBe(useCase);
    });

    it('targets union-eyes app', () => {
      expect(contract.app).toBe('union-eyes');
    });

    it('includes the analyst preamble in systemPrompt', () => {
      expect(contract.systemPrompt).toContain(CLC_ANALYST_PREAMBLE);
    });

    it('has a buildInput function', () => {
      expect(typeof contract.buildInput).toBe('function');
    });
  });

  // ── buildInput helpers ────────────────────────────────────────────────

  describe('buildSectorSignalsInput', () => {
    it('wraps signal data with dataType and format', () => {
      const signals = [
        { sector: 'Healthcare', clauseCount: 50, precedentCount: 12, totalCitations: 30, totalViews: 200, uniqueOrgs: 3, topClauseTypes: [{ clauseType: 'wages', count: 20 }] },
      ];
      const result = buildSectorSignalsInput(signals);
      expect(result).toHaveProperty('dataType', 'sector-signals');
      expect(result).toHaveProperty('sectorSignals', signals);
      expect(result).toHaveProperty('requestedFormat', 'briefing');
    });
  });

  describe('buildAffiliateEngagementInput', () => {
    it('wraps trend data with dataType and format', () => {
      const trends = [
        { organizationId: 'org-1', organizationName: 'Local 100', organizationType: 'local', clausesShared: 10, precedentsShared: 5, accessesInitiated: 8, resourcesAccessed: 12, clauseSharingEnabled: true, precedentSharingEnabled: true },
      ];
      const result = buildAffiliateEngagementInput(trends);
      expect(result).toHaveProperty('dataType', 'affiliate-trends');
      expect(result).toHaveProperty('affiliateTrends', trends);
      expect(result).toHaveProperty('requestedFormat', 'engagement-report');
    });
  });

  describe('buildKnowledgeIndexInput', () => {
    it('wraps knowledge index with dataType and format', () => {
      const index = {
        totalClauses: 200,
        totalPrecedents: 50,
        totalCitations: 120,
        totalViews: 800,
        uniqueOrgs: 8,
        topCited: [{ id: 'c1', title: 'Wage parity clause', type: 'clause' as const, citationCount: 15, sector: 'Healthcare' }],
        clauseTypeDistribution: [{ name: 'wages', value: 80 }],
        outcomeDistribution: [{ name: 'upheld', value: 35 }],
      };
      const result = buildKnowledgeIndexInput(index);
      expect(result).toHaveProperty('dataType', 'knowledge-index');
      expect(result).toHaveProperty('knowledgeIndex', index);
      expect(result).toHaveProperty('requestedFormat', 'health-report');
    });
  });

  describe('buildGovernanceHealthInput', () => {
    it('wraps governance summary with dataType and format', () => {
      const summary = {
        totalAffiliates: 20,
        consentedCrossUnion: 15,
        consentedSectorBenchmarks: 12,
        consentedNationalSignals: 18,
        sharingAdoption: { clauseSharingEnabled: 14, precedentSharingEnabled: 10, federationSharingEnabled: 8 },
        cohortHealth: 'healthy' as const,
      };
      const result = buildGovernanceHealthInput(summary);
      expect(result).toHaveProperty('dataType', 'governance-summary');
      expect(result).toHaveProperty('governanceSummary', summary);
      expect(result).toHaveProperty('requestedFormat', 'governance-briefing');
    });
  });
});
