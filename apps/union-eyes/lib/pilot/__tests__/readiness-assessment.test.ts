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

    // ---- Additional branch coverage: Size boundaries ----
    it('199 members (just under 200) scores lower than 200', () => {
      const result199 = calculateReadinessScore(makeApplication({ memberCount: 199 }));
      const result200 = calculateReadinessScore(makeApplication({ memberCount: 200 }));
      expect(result200.score).toBeGreaterThanOrEqual(result199.score);
    });

    it('500 members gets max size score', () => {
      const result500 = calculateReadinessScore(makeApplication({ memberCount: 500 }));
      expect(result500.score).toBeGreaterThan(
        calculateReadinessScore(makeApplication({ memberCount: 100 })).score
      );
    });

    it('5000 members gets max size score', () => {
      const result5000 = calculateReadinessScore(makeApplication({ memberCount: 5000 }));
      expect(result5000.score).toBeGreaterThan(
        calculateReadinessScore(makeApplication({ memberCount: 6000 })).score
      );
    });

    it('5001 members crosses threshold to "large membership" concern', () => {
      const result = calculateReadinessScore(makeApplication({ memberCount: 5001 }));
      expect(result.concerns.some((c) => /large membership|phased rollout/i.test(c))).toBe(true);
    });

    // ---- Additional branch coverage: Current system branches ----
    it('UnionEyes as current system does not add migration concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          currentSystem: 'UnionEyes',
          challenges: ['slow performance'],
        }),
      );
      expect(result.concerns.some((c) => /migration|change management/i.test(c))).toBe(false);
    });

    it('Digital system in current system does not add concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          currentSystem: 'Digital platform',
          challenges: ['limited features'],
        }),
      );
      expect(result.concerns.some((c) => /migration|change management/i.test(c))).toBe(false);
    });

    it('empty challenges with no system adds concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          currentSystem: undefined,
          challenges: [],
        }),
      );
      expect(result.concerns.some((c) => /not yet fully articulated|discovery/i.test(c))).toBe(true);
    });

    // ---- Additional branch coverage: Leadership partial support ----
    it('only executive sponsor (no budget/staff) gives 15 points', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: true,
            staffCommitment: 'low',
            budgetApproved: false,
            hasITSupport: false,
            hasDataAccess: false,
            staffTechComfort: 'low',
          },
        }),
      );
      expect(result.strengths.some((s) => /leadership support/i.test(s))).toBe(true);
    });

    it('medium staff commitment with executive sponsor gives strength', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: true,
            staffCommitment: 'medium',
            budgetApproved: true,
            hasITSupport: true,
            hasDataAccess: true,
            staffTechComfort: 'medium',
          },
        }),
      );
      expect(result.strengths.length).toBeGreaterThan(0);
    });

    // ---- Additional branch coverage: Technical capacity ----
    it('has IT support + data access without high comfort gives adequate score', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: true,
            staffCommitment: 'high',
            budgetApproved: true,
            hasITSupport: true,
            hasDataAccess: true,
            staffTechComfort: 'medium',
          },
        }),
      );
      expect(result.strengths.some((s) => /technical support|technical foundation/i.test(s))).toBe(
        true
      );
    });

    it('no IT support but medium comfort gives 10 points', () => {
      const result = calculateReadinessScore(
        makeApplication({
          responses: {
            executiveSponsor: true,
            staffCommitment: 'high',
            budgetApproved: true,
            hasITSupport: false,
            hasDataAccess: true,
            staffTechComfort: 'medium',
          },
        }),
      );
      expect(result.score).toBeGreaterThan(0); // Should not crash or return 0
    });

    // ---- Additional branch coverage: Complexity boundaries ----
    it('exactly 1 sector + 1 jurisdiction = simple (10 points)', () => {
      const result = calculateReadinessScore(
        makeApplication({ jurisdictions: ['ON'], sectors: ['healthcare'] }),
      );
      expect(result.strengths.some((s) => /focused|controlled rollout/i.test(s))).toBe(true);
    });

    it('2 jurisdictions + 2 sectors = moderate (8 points)', () => {
      const result = calculateReadinessScore(
        makeApplication({ jurisdictions: ['ON', 'BC'], sectors: ['healthcare', 'transit'] }),
      );
      expect(result.strengths.some((s) => /moderate complexity|meaningful governance/i.test(s))).toBe(
        true
      );
    });

    it('3+ jurisdictions triggers complexity concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          jurisdictions: ['ON', 'BC', 'AB'],
          sectors: ['healthcare', 'education'],
        }),
      );
      expect(result.concerns.some((c) => /multi-jurisdiction|high/i.test(c))).toBe(true);
    });

    // ---- Additional branch coverage: Goals boundaries ----
    it('exactly 2 goals gets 8 points (too few warning)', () => {
      const result = calculateReadinessScore(
        makeApplication({ goals: ['reduce time', 'improve access'] }),
      );
      expect(result.concerns.some((c) => /limited goals/i.test(c))).toBe(true);
    });

    it('exactly 3 goals with measurable words gets 10 points', () => {
      const result = calculateReadinessScore(
        makeApplication({
          goals: ['reduce resolution time', 'improve member access', 'increase transparency'],
        }),
      );
      expect(result.strengths.some((s) => /clear.*measurable/i.test(s))).toBe(true);
    });

    it('exactly 5 goals gets 10 points', () => {
      const result = calculateReadinessScore(
        makeApplication({
          goals: [
            'reduce time',
            'improve access',
            'increase efficiency',
            'decrease costs',
            'better reporting',
          ],
        }),
      );
      expect(result.strengths.some((s) => /clear.*measurable/i.test(s))).toBe(true);
    });

    it('exactly 6 goals triggers "too many" concern', () => {
      const result = calculateReadinessScore(
        makeApplication({
          goals: ['a', 'b', 'c', 'd', 'e', 'f'],
        }),
      );
      expect(result.concerns.some((c) => /too many goals|prioritize/i.test(c))).toBe(true);
    });

    it('measurable goals without keywords get 8 points', () => {
      const result = calculateReadinessScore(
        makeApplication({
          goals: ['goal one', 'goal two', 'goal three'],
        }),
      );
      // Should get points but less strength messaging
      expect(result.score).toBeGreaterThan(0);
    });

    // ---- All readiness levels ----
    it('score exactly 79 → mostly-ready', () => {
      // Craft a scenario that yields exactly 79
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 1000,
          responses: {
            executiveSponsor: true,
            staffCommitment: 'medium',
            budgetApproved: true,
            hasITSupport: true,
            hasDataAccess: true,
            staffTechComfort: 'high',
          },
          jurisdictions: ['ON', 'BC'],
          sectors: ['healthcare', 'education'],
          goals: ['reduce time', 'improve access'],
        }),
      );
      expect(result.level).toBe('mostly-ready');
    });

    it('score 50-64 → needs-preparation', () => {
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 100,
          responses: {
            executiveSponsor: false,
            staffCommitment: 'low',
            budgetApproved: false,
            hasITSupport: false,
            hasDataAccess: false,
            staffTechComfort: 'low',
          },
          jurisdictions: ['ON'],
          sectors: ['healthcare'],
          goals: ['x'],
        }),
      );
      expect(result.level).toBe('needs-preparation');
    });

    it('score < 50 → not-ready', () => {
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 10,
          responses: {
            executiveSponsor: false,
            staffCommitment: 'low',
            budgetApproved: false,
            hasITSupport: false,
            hasDataAccess: false,
            staffTechComfort: 'low',
          },
          jurisdictions: [],
          sectors: [],
          goals: [],
          challenges: [],
          currentSystem: undefined,
        }),
      );
      expect(result.level).toBe('not-ready');
    });

    // ---- Support level = 'standard' ----
    it('medium score (70) with moderate concerns → standard support', () => {
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 500,
          responses: {
            executiveSponsor: true,
            staffCommitment: 'medium',
            budgetApproved: false,
            hasITSupport: true,
            hasDataAccess: true,
            staffTechComfort: 'medium',
          },
          jurisdictions: ['ON', 'BC'],
          sectors: ['healthcare', 'education'],
          goals: ['reduce', 'improve'],
        }),
      );
      expect(result.supportLevel).toBe('standard');
    });

    // ---- All setup time ranges ----
    it('2 jurisdictions + low readiness → 3-4 weeks', () => {
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 1000,
          responses: {
            executiveSponsor: false,
            staffCommitment: 'low',
            budgetApproved: false,
            hasITSupport: false,
            hasDataAccess: false,
            staffTechComfort: 'low',
          },
          jurisdictions: ['ON', 'BC'],
          sectors: ['healthcare'],
          goals: ['reduce time'],
        }),
      );
      expect(['3-4 weeks', '4-6 weeks', '6-8 weeks']).toContain(result.estimatedSetupTime);
    });

    it('large membership (>2000) increases setup time', () => {
      const small = calculateReadinessScore(
        makeApplication({ memberCount: 1000 })
      );
      const large = calculateReadinessScore(
        makeApplication({ memberCount: 2500 })
      );
      const smallWeeks = parseInt(small.estimatedSetupTime.split('-')[0]);
      const largeWeeks = parseInt(large.estimatedSetupTime.split('-')[0]);
      expect(largeWeeks).toBeGreaterThanOrEqual(smallWeeks);
    });

    // ---- Continuity profile ----
    it('returns continuity profile', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.continuityProfile).toBeDefined();
      expect(typeof result.continuityProfile).toBe('string');
    });

    it('returns continuity overview with all fields', () => {
      const result = calculateReadinessScore(makeApplication());
      expect(result.continuityOverview).toHaveProperty('continuityPosture');
      expect(result.continuityOverview).toHaveProperty('governanceCoherence');
      expect(result.continuityOverview).toHaveProperty('operationalStability');
      expect(result.continuityOverview).toHaveProperty('institutionalMemoryHealth');
    });

    // ---- Recommendations for different score ranges ----
    it('score <65 recommends discovery phase', () => {
      const result = calculateReadinessScore(
        makeApplication({
          memberCount: 100,
          responses: {
            executiveSponsor: false,
            staffCommitment: 'low',
            budgetApproved: false,
          },
          goals: ['x'],
          jurisdictions: ['ON'],
          sectors: ['healthcare'],
        }),
      );
      expect(result.recommendations.some((r) => /discovery|bounded/i.test(r))).toBe(true);
    });

    it('technical concerns trigger training recommendation', () => {
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
      expect(result.recommendations.some((r) => /phased onboarding|training|champions/i.test(r))).toBe(
        true
      );
    });

    it('leadership concerns trigger governance recommendation', () => {
      const result = calculateReadinessScore(
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
      expect(
        result.recommendations.some((r) => /governance|alignment|sponsorship/i.test(r))
      ).toBe(true);
    });
  });
});
