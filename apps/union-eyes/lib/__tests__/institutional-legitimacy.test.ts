import { describe, it, expect } from 'vitest';
import {
  institutionalRolloutPathway,
  buildContinuityReadinessProfile,
  buildExecutiveReadinessOutputs,
  type ContinuityReadinessProfile,
} from '../institutional-legitimacy';

describe('lib/institutional-legitimacy', () => {
  it('exposes localized rollout pathways', () => {
    expect(institutionalRolloutPathway['en-CA'][0]).toBe('Assessment');
    expect(institutionalRolloutPathway['fr-CA'][0]).toBe('Évaluation');
  });

  describe('buildContinuityReadinessProfile', () => {
    it('produces a low (Foundational/Developing) profile for a fragmented application', () => {
      const profile = buildContinuityReadinessProfile({
        challenges: Array.from({ length: 8 }, (_, i) => `c${i}`) as never,
        jurisdictions: ['a', 'b', 'c'] as never,
        goals: [] as never,
        responses: { modules: [], leadershipSupport: 'no' },
      });
      expect(['Foundational', 'Developing']).toContain(profile.level);
      expect(profile.dimensions).toHaveLength(5);
      expect(profile.summary).toBeTruthy();
    });

    it('produces a higher profile for a focused, well-supported application', () => {
      const profile = buildContinuityReadinessProfile({
        challenges: [] as never,
        jurisdictions: ['a'] as never,
        goals: ['g1', 'g2', 'g3'] as never,
        responses: { modules: ['m1', 'm2', 'm3'], leadershipSupport: 'yes' },
      });
      expect(['Stabilizing', 'Operationally Mature']).toContain(profile.level);
    });

    it('handles the unsure leadership and mid-range branches', () => {
      const profile = buildContinuityReadinessProfile({
        challenges: ['c1', 'c2'] as never,
        jurisdictions: ['a', 'b'] as never,
        goals: ['g1'] as never,
        responses: { modules: ['m1'], leadershipSupport: 'unsure' },
      });
      expect(profile.dimensions.find((d) => d.label === 'Governance Coherence')?.score).toBe(3);
    });

    it('tolerates a completely empty application', () => {
      const profile = buildContinuityReadinessProfile({});
      expect(profile.dimensions).toHaveLength(5);
    });
  });

  describe('buildExecutiveReadinessOutputs', () => {
    const baseProfile = (
      level: ContinuityReadinessProfile['level'],
    ): ContinuityReadinessProfile => ({
      level,
      summary: `${level} summary`,
      dimensions: [
        { label: 'Governance Coherence', score: 4, summary: 'gov summary' },
        { label: 'Operational Fragmentation', score: 4, summary: 'frag summary' },
        { label: 'Organizational Memory Risk', score: 4, summary: 'mem summary' },
      ],
    });

    it('builds outputs for an Operationally Mature profile', () => {
      const outputs = buildExecutiveReadinessOutputs(baseProfile('Operationally Mature'), {
        currentSystem: 'LegacyCRM',
        jurisdictions: ['a'] as never,
        sectors: ['public'] as never,
      });
      expect(outputs.continuityProfile).toBe('Operationally Mature summary');
      expect(outputs.continuityOverview.continuityPosture).toContain('durable');
      expect(outputs.governanceAlignmentSummary).toContain('strong governance alignment');
      expect(outputs.fragmentationObservations[0]).toContain('LegacyCRM');
    });

    it('builds outputs for a Stabilizing profile', () => {
      const outputs = buildExecutiveReadinessOutputs(baseProfile('Stabilizing'), {});
      expect(outputs.continuityOverview.continuityPosture).toContain('stabilizing');
      expect(outputs.rolloutRecommendation).toContain('keep review windows open');
      // No currentSystem provided → fallback observation.
      expect(outputs.fragmentationObservations[0]).toContain('not fully specified');
    });

    it('builds outputs for Foundational and Developing profiles', () => {
      const foundational = buildExecutiveReadinessOutputs(baseProfile('Foundational'), {});
      expect(foundational.rolloutRecommendation).toContain('continuity assessment');

      const developing = buildExecutiveReadinessOutputs(baseProfile('Developing'), {});
      expect(developing.rolloutRecommendation).toContain('bounded pilot');
    });

    it('uses fallback summaries when expected dimensions are absent', () => {
      const profile: ContinuityReadinessProfile = {
        level: 'Developing',
        summary: 'sum',
        dimensions: [],
      };
      const outputs = buildExecutiveReadinessOutputs(profile, {});
      expect(outputs.continuityOverview.governanceCoherence).toContain('being established');
      expect(outputs.continuityOverview.operationalStability).toContain('phased activation');
      expect(outputs.continuityOverview.institutionalMemoryHealth).toContain('transfer routines');
      expect(outputs.fragmentationObservations[2]).toContain('being reviewed');
    });
  });
});
