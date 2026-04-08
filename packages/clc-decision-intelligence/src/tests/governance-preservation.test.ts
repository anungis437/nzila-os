/**
 * Governance Preservation — Integration Tests
 *
 * These tests verify that the Decision Intelligence Layer
 * operates ON TOP of governance — it never weakens it.
 */
import { describe, it, expect } from 'vitest';
import {
  detectAllPatterns,
  deriveMovementRiskPosture,
  runDecisionIntelligencePipeline,
  generateRecommendations,
  computeConfidence,
  confidenceBandFromScore,
} from '../index.js';
import type { SectorAggregate, SectorTimeSeries } from '../correlation/index.js';

describe('governance preservation', () => {
  describe('aggregate safety', () => {
    it('correlation engine never exposes individual org names', () => {
      const sectors: SectorAggregate[] = [
        { sector: 'Mining', clauseCount: 30, precedentCount: 10, totalCitations: 50, totalViews: 200, uniqueOrgs: 10, topClauseTypes: [{ clauseType: 'Wages', count: 15 }] },
        { sector: 'Education', clauseCount: 20, precedentCount: 5, totalCitations: 30, totalViews: 150, uniqueOrgs: 8, topClauseTypes: [{ clauseType: 'Wages', count: 10 }] },
        { sector: 'Healthcare', clauseCount: 25, precedentCount: 8, totalCitations: 40, totalViews: 180, uniqueOrgs: 9, topClauseTypes: [{ clauseType: 'Wages', count: 12 }] },
      ];
      const patterns = detectAllPatterns(sectors, [], []);

      for (const p of patterns) {
        // Patterns should reference sectors, not individual orgs
        expect(p.affectedSectors.every((s) => sectors.some((sec) => sec.sector === s))).toBe(true);
        // Summary should not contain "Org-" or "affiliate-" specific names
        expect(p.summary).not.toMatch(/Org-\d+/);
        expect(p.title).not.toMatch(/Org-\d+/);
      }
    });

    it('recommendations reference signal IDs not org names', () => {
      const sectors: SectorAggregate[] = [
        { sector: 'A', clauseCount: 100, precedentCount: 50, totalCitations: 50, totalViews: 200, uniqueOrgs: 10, topClauseTypes: [{ clauseType: 'Wages', count: 50 }] },
        { sector: 'B', clauseCount: 10, precedentCount: 2, totalCitations: 10, totalViews: 50, uniqueOrgs: 5, topClauseTypes: [{ clauseType: 'Wages', count: 5 }] },
        { sector: 'C', clauseCount: 12, precedentCount: 3, totalCitations: 15, totalViews: 60, uniqueOrgs: 6, topClauseTypes: [{ clauseType: 'Wages', count: 6 }] },
      ];
      const patterns = detectAllPatterns(sectors, [], []);
      const recs = generateRecommendations(patterns);

      for (const rec of recs) {
        expect(rec.signalId).toBeTruthy();
        expect(rec.rationale).not.toMatch(/individual|specific.*affiliate/i);
      }
    });
  });

  describe('confidence model integrity', () => {
    it('confidence is always between 0 and 1', () => {
      const extremeInputs = [
        { cohortSize: 0, recencyDays: 0, signalAgreement: 0, sourceCount: 0, persistenceScore: 0, missingDataPenalty: 0 },
        { cohortSize: 100, recencyDays: 365, signalAgreement: 1, sourceCount: 50, persistenceScore: 1, missingDataPenalty: 1 },
        { cohortSize: 1, recencyDays: 1, signalAgreement: 0.5, sourceCount: 1, persistenceScore: 0.5, missingDataPenalty: 0.5 },
      ];

      for (const inputs of extremeInputs) {
        const result = computeConfidence(inputs);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(['high', 'medium', 'low']).toContain(result.confidenceBand);
      }
    });

    it('confidence band correctly reflects score', () => {
      expect(confidenceBandFromScore(0.71)).toBe('high');
      expect(confidenceBandFromScore(0.55)).toBe('medium');
      expect(confidenceBandFromScore(0.2)).toBe('low');
    });
  });

  describe('pipeline completeness', () => {
    it('pipeline output includes all required data products', () => {
      const sectors: SectorAggregate[] = [
        { sector: 'Mining', clauseCount: 30, precedentCount: 10, totalCitations: 50, totalViews: 200, uniqueOrgs: 10, topClauseTypes: [{ clauseType: 'Wages', count: 15 }] },
        { sector: 'Education', clauseCount: 20, precedentCount: 5, totalCitations: 30, totalViews: 150, uniqueOrgs: 8, topClauseTypes: [{ clauseType: 'Hours', count: 10 }] },
      ];
      const output = runDecisionIntelligencePipeline(sectors, [], []);

      // All data products must be present
      expect(output.riskPosture).toBeDefined();
      expect(output.riskPosture.posture).toBeTruthy();
      expect(output.riskPosture.summary).toBeTruthy();

      expect(output.sectorDivergence).toBeDefined();
      expect(Array.isArray(output.sectorDivergence)).toBe(true);

      expect(Array.isArray(output.patterns)).toBe(true);
      expect(Array.isArray(output.recommendations)).toBe(true);
      expect(Array.isArray(output.briefingCards)).toBe(true);

      // bargainingWatch can be null — that's valid
      expect(output.bargainingWatch === null || typeof output.bargainingWatch === 'object').toBe(true);
    });

    it('pipeline never throws for empty inputs', () => {
      expect(() => runDecisionIntelligencePipeline([], [], [])).not.toThrow();
      const output = runDecisionIntelligencePipeline([], [], []);
      expect(output.riskPosture.posture).toBe('steady');
      expect(output.patterns).toEqual([]);
      expect(output.recommendations).toEqual([]);
    });
  });
});
