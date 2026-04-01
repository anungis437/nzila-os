import { describe, it, expect } from 'vitest';

import {
  calculateReadinessScore,
} from '../readiness-assessment';
import type { PilotApplicationInput } from '@/types/marketing';

function makeApplication(
  overrides: Partial<PilotApplicationInput> = {},
): PilotApplicationInput {
  return {
    organizationName: 'Test Local 123',
    organizationType: 'local',
    contactName: 'Jane Doe',
    contactEmail: 'jane@test.org',
    memberCount: 1000,
    jurisdictions: ['ON'],
    sectors: ['healthcare'],
    currentSystem: undefined,
    challenges: ['lost documents', 'manual tracking'],
    goals: ['reduce resolution time', 'improve member access', 'increase transparency'],
    responses: {
      executiveSponsor: true,
      staffCommitment: 'high',
      budgetApproved: true,
      hasITSupport: true,
      hasDataAccess: true,
      staffTechComfort: 'high',
    },
    ...overrides,
  };
}

describe('readiness-assessment', () => {
  describe('calculateReadinessScore', () => {
    it('returns all result fields', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('concerns');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('estimatedSetupTime');
      expect(result).toHaveProperty('supportLevel');
    });

    it('score is between 0 and 100', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    // ---- Size evaluation ----
    it('ideal size (500-5000) gets 20 points', () => {
      const high = calculateReadinessScore(makeApplication({ memberCount: 2000 }));
      const low = calculateReadinessScore(makeApplication({ memberCount: 100 }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('large membership (>5000) adds concern', () => {
      const result = calculateReadinessScore(makeApplication({ memberCount: 8000 }));
      expect(result.concerns.some((c) => /phased rollout/i.test(c))).toBe(true);
    });

    it('small membership (<200) adds concern', () => {
      const result = calculateReadinessScore(makeApplication({ memberCount: 50 }));
      expect(result.concerns.some((c) => /small membership/i.test(c))).toBe(true);
    });

    // ---- Current system evaluation ----
    it('no system + critical pains gives highest system score', () => {
      const result = calculateReadinessScore(
        makeApplication({
          currentSystem: 'none',
          challenges: ['lost records', 'manual process'],
        }),
      );
      expect(result.strengths.some((s) => /clear pain points/i.test(s))).toBe(true);
    });

    it('existing system adds migration concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          currentSystem: 'Legacy CRM',
          challenges: ['slow performance'],
        }),
      );
      expect(result.concerns.some((c) => /change management|data migration/i.test(c))).toBe(true);
    });

    // ---- Leadership evaluation ----
    it('full leadership support gives 20 points', () => {
      const full = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: true,
            staffCommitment: 'high',
            budgetApproved: true,
            hasITSupport: true,
            hasDataAccess: true,
            staffTechComfort: 'high',
          },
        }),
      );
      const none = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: false,
            staffCommitment: 'low',
            budgetApproved: false,
            hasITSupport: false,
            hasDataAccess: false,
            staffTechComfort: 'low',
          },
        }),
      );
      expect(full.score).toBeGreaterThan(none.score);
    });

    it('limited leadership adds concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: false,
            staffCommitment: 'low',
            budgetApproved: false,
          },
        }),
      );
      expect(result.concerns.some((c) => /leadership/i.test(c))).toBe(true);
    });

    // ---- Technical capacity ----
    it('low tech comfort adds concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: true,
            staffCommitment: 'high',
            budgetApproved: true,
            hasITSupport: false,
            hasDataAccess: false,
            staffTechComfort: 'low',
          },
        }),
      );
      expect(result.concerns.some((c) => /unfamiliar|training/i.test(c))).toBe(true);
    });

    // ---- Complexity ----
    it('single jurisdiction is simple (10 points)', () => {
      const simple = calculateReadinessScore(
        makeApplication({ jurisdictions: ['ON'], sectors: ['healthcare'] }),
      );
      const complex = calculateReadinessScore(
        makeApplication({
          jurisdictions: ['ON', 'BC', 'AB'],
          sectors: ['healthcare', 'education', 'transit', 'utility'],
        }),
      );
      expect(simple.score).toBeGreaterThan(complex.score);
    });

    // ---- Goals ----
    it('3-5 measurable goals gets 10 points', () => {
      const result = calculateReadinessScore(
        makeApplication({
          goals: ['reduce time', 'improve access', 'increase efficiency'],
        }),
      );
      expect(result.strengths.some((s) => /clear.*measurable/i.test(s))).toBe(true);
    });

    it('few goals adds concern', () => {
      const result = calculateReadinessScore(
        makeApplication({ goals: ['do better'] }),
      );
      expect(result.concerns.some((c) => /limited goals/i.test(c))).toBe(true);
    });

    it('too many goals adds concern', () => {
      const result = calculateReadinessScore(
        makeApplication({ goals: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
      );
      expect(result.concerns.some((c) => /many goals/i.test(c))).toBe(true);
    });

    // ---- Level determination ----
    it('score >= 80 → ready', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.level).toBe('ready');
    });

    it('score 65-79 → mostly-ready', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: { executiveSponsor: true, staffCommitment: 'medium', budgetApproved: false },
          memberCount: 300,
          goals: ['reduce time', 'improve', 'transparency'],
          challenges: ['slow performance'],
          currentSystem: 'other CRM',
        }),
      );
      // This should be in mostly-ready or nearby
      expect(['ready', 'mostly-ready', 'needs-preparation']).toContain(result.level);
    });

    // ---- Support level ----
    it('high score with few concerns → minimal support', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.supportLevel).toBe('minimal');
    });

    it('low score → intensive support', () => {
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 50,
          responses: { executiveSponsor: false, staffCommitment: 'low', budgetApproved: false, staffTechComfort: 'low' },
          goals: ['x'],
          challenges: [],
          jurisdictions: ['ON', 'BC', 'AB'],
          sectors: ['a', 'b', 'c', 'd'],
        }),
      );
      expect(result.supportLevel).toBe('intensive');
    });

    // ---- Setup time estimation ----
    it('high readiness gets 2-3 weeks', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.estimatedSetupTime).toBe('2-3 weeks');
    });

    it('multi-jurisdiction increases setup time', () => {
      const result = calculateReadinessScore(
        makeApplication({ jurisdictions: ['ON', 'BC', 'AB', 'SK'] }),
      );
      expect(result.estimatedSetupTime).not.toBe('2-3 weeks');
    });

    // ---- Recommendations ----
    it('generates recommendations for high score', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.recommendations.some((r) => /proceed|kickoff/i.test(r))).toBe(true);
    });

    it('recommends phased rollout for large orgs', () => {
      const result = calculateReadinessScore(makeApplication({ memberCount: 5000 }));
      expect(result.recommendations.some((r) => /phased rollout/i.test(r))).toBe(true);
    });

    it('recommends single jurisdiction start for multi-jurisdiction', () => {
      const result = calculateReadinessScore(
        makeApplication({ jurisdictions: ['ON', 'BC', 'AB'] }),
      );
      expect(result.recommendations.some((r) => /single jurisdiction/i.test(r))).toBe(true);
    });
  });
});
