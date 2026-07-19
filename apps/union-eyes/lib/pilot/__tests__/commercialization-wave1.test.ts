import { describe, expect, it } from 'vitest';

import {
  buildPilotArtifactDiffSummary,
  buildPilotArtifactVersionRecord,
  buildPilotReferenceVersionRecord,
  buildProposalPackage,
  calculateCommercialSignals,
  calculatePilotQualificationScores,
  getOpportunityTier,
  getQualification,
  getRecommendedEconomicsTier,
  inferPilotStatusFromCommercialState,
  isCommercialTransitionAllowed,
  nextCommercialState,
  normalizeCommercialState,
  previousCommercialState,
} from '../commercialization-wave1';
import type { PilotApplicationCommercialInput } from '../commercialization-wave1';

const application: PilotApplicationCommercialInput = {
  id: 'app-1',
  organizationName: 'Local 100',
  organizationType: 'local',
  contactName: 'Jane Doe',
  contactEmail: 'jane@example.org',
  memberCount: 300,
  jurisdictions: ['QC'],
  sectors: ['public'],
  currentSystem: 'Legacy',
  challenges: ['grievance backlog'],
  goals: ['faster resolution'],
  readinessScore: 80,
};

describe('lib/pilot/commercialization-wave1', () => {
  describe('getOpportunityTier', () => {
    it('maps score to tier', () => {
      expect(getOpportunityTier(85)).toBe('A');
      expect(getOpportunityTier(70)).toBe('B');
      expect(getOpportunityTier(40)).toBe('C');
    });
  });

  describe('getRecommendedEconomicsTier', () => {
    it('selects tier by member count', () => {
      expect(getRecommendedEconomicsTier(100).id).toBe('starter-local');
      expect(getRecommendedEconomicsTier(1000).id).toBe('mid-local');
      expect(getRecommendedEconomicsTier(50000).id).toBe('provincial-org');
      expect(getRecommendedEconomicsTier(0).id).toBe('starter-local');
    });
  });

  describe('commercial state helpers', () => {
    it('normalizes unknown values to lead', () => {
      expect(normalizeCommercialState('pilot')).toBe('pilot');
      expect(normalizeCommercialState('bogus')).toBe('lead');
      expect(normalizeCommercialState(null)).toBe('lead');
    });
    it('advances and reverses state safely', () => {
      expect(nextCommercialState('lead')).toBe('qualified');
      expect(nextCommercialState('subscription_active')).toBe('subscription_active');
      expect(previousCommercialState('qualified')).toBe('lead');
      expect(previousCommercialState('lead')).toBe('lead');
    });
    it('allows only adjacent or same transitions', () => {
      expect(isCommercialTransitionAllowed('lead', 'qualified')).toBe(true);
      expect(isCommercialTransitionAllowed('lead', 'lead')).toBe(true);
      expect(isCommercialTransitionAllowed('lead', 'pilot')).toBe(false);
      expect(isCommercialTransitionAllowed('lead', 'bogus' as never)).toBe(false);
    });
  });

  describe('inferPilotStatusFromCommercialState', () => {
    it('maps states to pilot status', () => {
      expect(inferPilotStatusFromCommercialState('lead')).toBe('submitted');
      expect(inferPilotStatusFromCommercialState('pilot')).toBe('review');
      expect(inferPilotStatusFromCommercialState('approved')).toBe('approved');
      expect(inferPilotStatusFromCommercialState('pilot_active')).toBe('active');
      expect(inferPilotStatusFromCommercialState('subscription_active')).toBe('completed');
    });
  });

  describe('getQualification', () => {
    it('handles null, qualified, review, defer', () => {
      expect(getQualification(null, 100)).toBe('review-required');
      expect(getQualification(80, 400)).toBe('qualified');
      expect(getQualification(60, 100)).toBe('review-required');
      expect(getQualification(20, 100)).toBe('defer');
    });
  });

  describe('calculatePilotQualificationScores', () => {
    it('returns clamped scores and a tier', () => {
      const s = calculatePilotQualificationScores(application, { readinessScore: 80, commercialState: 'pilot' });
      expect(s.overallOpportunityScore).toBeGreaterThanOrEqual(0);
      expect(s.overallOpportunityScore).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C']).toContain(s.opportunityTier);
    });
  });

  describe('calculateCommercialSignals', () => {
    it('derives bounded scores and likelihood bands', () => {
      const sig = calculateCommercialSignals({ readinessScore: 90, commercialState: 'pilot_active', memberCount: 12000 });
      expect(sig.adoptionScore).toBeLessThanOrEqual(100);
      expect(sig.arrPotentialBand).toBe('large');
      expect(['low', 'medium', 'high']).toContain(sig.renewalLikelihood);
    });
  });

  describe('version records', () => {
    it('builds deterministic artifact and reference version records', () => {
      const scores = calculatePilotQualificationScores(application, { readinessScore: 80, commercialState: 'pilot' });
      const pkg = buildProposalPackage(application, { commercialState: 'pilot' });
      const art = buildPilotArtifactVersionRecord({
        generatedAt: '2025-01-02T03:04:05.000Z',
        source: 'test',
        commercialState: 'pilot',
        qualificationScores: scores,
        artifacts: pkg.artifacts,
      });
      expect(art.versionId).toMatch(/^art_/);
      expect(art.checksum).toHaveLength(8);

      const ref = buildPilotReferenceVersionRecord({
        generatedAt: '2025-01-02T03:04:05.000Z',
        source: 'test',
        referenceProfile: { a: 1 },
        caseStudy: { b: 2 },
        benchmarkDataset: { c: 3 },
      });
      expect(ref.versionId).toMatch(/^ref_/);
      expect(ref.checksum).toHaveLength(8);
    });
  });

  describe('buildProposalPackage', () => {
    it('produces a full proposal package with markdown', () => {
      const pkg = buildProposalPackage(application);
      expect(pkg.economicsTier.id).toBe('starter-local');
      expect(pkg.markdown).toContain('Union Eyes Pilot Proposal Package');
      expect(pkg.commercialStateOrder.length).toBeGreaterThan(0);
    });
  });

  describe('buildPilotArtifactDiffSummary', () => {
    it('summarizes differences between two artifact version records', () => {
      const scores = calculatePilotQualificationScores(application, { readinessScore: 80, commercialState: 'pilot' });
      const older = buildPilotArtifactVersionRecord({
        generatedAt: '2025-01-02T03:04:05.000Z',
        source: 'test',
        commercialState: 'pilot',
        qualificationScores: scores,
        artifacts: buildProposalPackage(application, { commercialState: 'pilot' }).artifacts,
      });
      const changedApp = { ...application, organizationName: 'Local 200', memberCount: 12000 };
      const newer = buildPilotArtifactVersionRecord({
        generatedAt: '2025-02-02T03:04:05.000Z',
        source: 'test',
        commercialState: 'pilot_active',
        qualificationScores: calculatePilotQualificationScores(changedApp, {
          readinessScore: 90,
          commercialState: 'pilot_active',
        }),
        artifacts: buildProposalPackage(changedApp, { commercialState: 'pilot_active' }).artifacts,
      });
      const diff = buildPilotArtifactDiffSummary(older, newer);
      expect(Array.isArray(diff.changedArtifactKeys)).toBe(true);
    });
  });
});
