import { describe, it, expect } from 'vitest';

import {
  predictPilotSuccess,
  predictMemberEngagement,
  predictOrganizerRetentionRisk,
  batchPredictPilotSuccess,
  type PredictionResult,
  type PilotSuccessPredictionInput,
  type MemberEngagementPredictionInput,
  type OrganizerRetentionPredictionInput,
} from '../predictive-scoring';

function makePilotInput(
  overrides: Partial<PilotSuccessPredictionInput> = {},
): PilotSuccessPredictionInput {
  return {
    organizationType: 'local',
    memberCount: 1500,
    sectors: ['healthcare'],
    jurisdictions: ['ON'],
    readinessScore: 85,
    currentSystem: 'paper-based',
    challenges: ['lost docs'],
    goals: ['improve'],
    leadershipBuyIn: 'high',
    ...overrides,
  };
}

function makeMemberInput(
  overrides: Partial<MemberEngagementPredictionInput> = {},
): MemberEngagementPredictionInput {
  return {
    memberSince: new Date(Date.now() - 400 * 86400000), // ~13 months
    caseCount: 6,
    lastActivityDate: new Date(Date.now() - 3 * 86400000), // 3 days ago
    communicationPreferences: { email: true, sms: true, push: true },
    issueTypes: ['grievance'],
    resolutionRate: 80,
    ...overrides,
  };
}

function makeOrganizerInput(
  overrides: Partial<OrganizerRetentionPredictionInput> = {},
): OrganizerRetentionPredictionInput {
  return {
    organizerSince: new Date(Date.now() - 365 * 86400000),
    casesHandled: 20,
    avgCaseResolutionTime: 15,
    memberSatisfactionScore: 85,
    lastLoginDate: new Date(Date.now() - 2 * 86400000),
    impactScore: 80,
    recognitionEvents: 5,
    ...overrides,
  };
}

describe('predictive-scoring', () => {
  describe('predictPilotSuccess', () => {
    it('returns all PredictionResult fields', () => {
      const result = predictPilotSuccess(makePilotInput());
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('interpretation');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('recommendations');
    });

    it('score is between 0 and 100', () => {
      const result = predictPilotSuccess(makePilotInput());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('higher member count → higher score', () => {
      const small = predictPilotSuccess(makePilotInput({ memberCount: 50 }));
      const large = predictPilotSuccess(makePilotInput({ memberCount: 2000 }));
      expect(large.score).toBeGreaterThan(small.score);
    });

    it('higher readiness → higher score', () => {
      const low = predictPilotSuccess(makePilotInput({ readinessScore: 20 }));
      const high = predictPilotSuccess(makePilotInput({ readinessScore: 95 }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('paper-based system gives highest system score', () => {
      const paper = predictPilotSuccess(makePilotInput({ currentSystem: 'paper-based' }));
      const legacy = predictPilotSuccess(makePilotInput({ currentSystem: 'legacy-software' }));
      expect(paper.score).toBeGreaterThan(legacy.score);
    });

    it('high leadership → higher score than low', () => {
      const high = predictPilotSuccess(makePilotInput({ leadershipBuyIn: 'high' }));
      const low = predictPilotSuccess(makePilotInput({ leadershipBuyIn: 'low' }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('single jurisdiction → higher than many', () => {
      const single = predictPilotSuccess(makePilotInput({ jurisdictions: ['ON'] }));
      const multi = predictPilotSuccess(makePilotInput({ jurisdictions: ['ON', 'BC', 'AB'] }));
      expect(single.score).toBeGreaterThan(multi.score);
    });

    it('high score interpretation mentions "High likelihood"', () => {
      const result = predictPilotSuccess(makePilotInput());
      expect(result.interpretation).toContain('High likelihood');
    });

    it('low score interpretation mentions risk', () => {
      const result = predictPilotSuccess(
        makePilotInput({
          memberCount: 30,
          readinessScore: 10,
          leadershipBuyIn: 'low',
          currentSystem: 'legacy-software',
          jurisdictions: ['ON', 'BC', 'AB', 'SK'],
        }),
      );
      expect(result.interpretation).toMatch(/low likelihood|uncertain|challenges/i);
    });

    it('generates recommendation for low leadership', () => {
      const result = predictPilotSuccess(makePilotInput({ leadershipBuyIn: 'low' }));
      expect(result.recommendations.some((r) => /leadership/i.test(r))).toBe(true);
    });

    it('generates recommendation for many jurisdictions', () => {
      const result = predictPilotSuccess(
        makePilotInput({ jurisdictions: ['ON', 'BC', 'AB'] }),
      );
      expect(result.recommendations.some((r) => /phased rollout/i.test(r))).toBe(true);
    });

    it('well-positioned recommendation when all good', () => {
      const result = predictPilotSuccess(makePilotInput());
      expect(
        result.recommendations.some((r) => /well-positioned/i.test(r)),
      ).toBe(true);
    });

    it('factors array has 5 entries', () => {
      const result = predictPilotSuccess(makePilotInput());
      expect(result.factors).toHaveLength(5);
    });
  });

  describe('predictMemberEngagement', () => {
    it('returns all PredictionResult fields', () => {
      const result = predictMemberEngagement(makeMemberInput());
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('interpretation');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('recommendations');
    });

    it('score between 0 and 100', () => {
      const result = predictMemberEngagement(makeMemberInput());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('long tenure → higher score', () => {
      const newMember = predictMemberEngagement(
        makeMemberInput({ memberSince: new Date(Date.now() - 30 * 86400000) }),
      );
      const oldMember = predictMemberEngagement(
        makeMemberInput({ memberSince: new Date(Date.now() - 400 * 86400000) }),
      );
      expect(oldMember.score).toBeGreaterThan(newMember.score);
    });

    it('recent activity → higher recency score', () => {
      const active = predictMemberEngagement(
        makeMemberInput({ lastActivityDate: new Date(Date.now() - 2 * 86400000) }),
      );
      const stale = predictMemberEngagement(
        makeMemberInput({ lastActivityDate: new Date(Date.now() - 100 * 86400000) }),
      );
      expect(active.score).toBeGreaterThan(stale.score);
    });

    it('more cases → higher case score', () => {
      const few = predictMemberEngagement(makeMemberInput({ caseCount: 0 }));
      const many = predictMemberEngagement(makeMemberInput({ caseCount: 10 }));
      expect(many.score).toBeGreaterThan(few.score);
    });

    it('higher resolution rate → higher score', () => {
      const low = predictMemberEngagement(makeMemberInput({ resolutionRate: 10 }));
      const high = predictMemberEngagement(makeMemberInput({ resolutionRate: 100 }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('more comm preferences set → higher score', () => {
      const none = predictMemberEngagement(
        makeMemberInput({
          communicationPreferences: { email: false, sms: false, push: false },
        }),
      );
      const all = predictMemberEngagement(
        makeMemberInput({
          communicationPreferences: { email: true, sms: true, push: true },
        }),
      );
      expect(all.score).toBeGreaterThan(none.score);
    });

    it('confidence higher with case history', () => {
      const noCases = predictMemberEngagement(makeMemberInput({ caseCount: 0 }));
      const hasCases = predictMemberEngagement(makeMemberInput({ caseCount: 5 }));
      expect(hasCases.confidence).toBeGreaterThan(noCases.confidence);
    });

    it('highly engaged interpretation', () => {
      const result = predictMemberEngagement(makeMemberInput());
      expect(result.interpretation).toMatch(/highly engaged/i);
    });

    it('at-risk interpretation for inactive member', () => {
      const result = predictMemberEngagement(
        makeMemberInput({
          memberSince: new Date(Date.now() - 30 * 86400000),
          caseCount: 0,
          lastActivityDate: new Date(Date.now() - 120 * 86400000),
          communicationPreferences: { email: false, sms: false, push: false },
          resolutionRate: 0,
        }),
      );
      expect(result.interpretation).toMatch(/at-risk|low engagement/i);
    });

    it('recommends re-engagement for inactive', () => {
      const result = predictMemberEngagement(
        makeMemberInput({
          lastActivityDate: new Date(Date.now() - 90 * 86400000),
        }),
      );
      expect(result.recommendations.some((r) => /re-engagement/i.test(r))).toBe(true);
    });

    it('recommends setup for no comm prefs', () => {
      const result = predictMemberEngagement(
        makeMemberInput({
          communicationPreferences: { email: false, sms: false, push: false },
        }),
      );
      expect(result.recommendations.some((r) => /preferences/i.test(r))).toBe(true);
    });
  });

  describe('predictOrganizerRetentionRisk', () => {
    it('returns all PredictionResult fields', () => {
      const result = predictOrganizerRetentionRisk(makeOrganizerInput());
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('interpretation');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('recommendations');
    });

    it('score between 0 and 100', () => {
      const result = predictOrganizerRetentionRisk(makeOrganizerInput());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('high caseload → higher risk', () => {
      const low = predictOrganizerRetentionRisk(makeOrganizerInput({ casesHandled: 10 }));
      const high = predictOrganizerRetentionRisk(makeOrganizerInput({ casesHandled: 60 }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('long resolution time → higher risk', () => {
      const fast = predictOrganizerRetentionRisk(
        makeOrganizerInput({ avgCaseResolutionTime: 10 }),
      );
      const slow = predictOrganizerRetentionRisk(
        makeOrganizerInput({ avgCaseResolutionTime: 70 }),
      );
      expect(slow.score).toBeGreaterThan(fast.score);
    });

    it('old last login → higher risk', () => {
      const recent = predictOrganizerRetentionRisk(
        makeOrganizerInput({ lastLoginDate: new Date(Date.now() - 86400000) }),
      );
      const stale = predictOrganizerRetentionRisk(
        makeOrganizerInput({ lastLoginDate: new Date(Date.now() - 30 * 86400000) }),
      );
      expect(stale.score).toBeGreaterThan(recent.score);
    });

    it('no recognition → higher risk', () => {
      const none = predictOrganizerRetentionRisk(
        makeOrganizerInput({ recognitionEvents: 0 }),
      );
      const some = predictOrganizerRetentionRisk(
        makeOrganizerInput({ recognitionEvents: 5 }),
      );
      expect(none.score).toBeGreaterThan(some.score);
    });

    it('low satisfaction → higher risk', () => {
      const low = predictOrganizerRetentionRisk(
        makeOrganizerInput({ memberSatisfactionScore: 20 }),
      );
      const high = predictOrganizerRetentionRisk(
        makeOrganizerInput({ memberSatisfactionScore: 95 }),
      );
      expect(low.score).toBeGreaterThan(high.score);
    });

    it('very low risk interpretation for healthy organizer', () => {
      const result = predictOrganizerRetentionRisk(makeOrganizerInput());
      expect(result.interpretation).toMatch(/very low burnout|low burnout|thriving/i);
    });

    it('high risk interpretation for stressed organizer', () => {
      const result = predictOrganizerRetentionRisk(
        makeOrganizerInput({
          casesHandled: 60,
          avgCaseResolutionTime: 70,
          lastLoginDate: new Date(Date.now() - 20 * 86400000),
          recognitionEvents: 0,
          memberSatisfactionScore: 20,
        }),
      );
      expect(result.interpretation).toMatch(/high.*burnout/i);
    });

    it('recommends redistribution for overloaded', () => {
      const result = predictOrganizerRetentionRisk(
        makeOrganizerInput({ casesHandled: 60 }),
      );
      expect(result.recommendations.some((r) => /redistribute/i.test(r))).toBe(true);
    });

    it('recommends recognition for unrecognized', () => {
      const result = predictOrganizerRetentionRisk(
        makeOrganizerInput({ recognitionEvents: 0 }),
      );
      expect(result.recommendations.some((r) => /recognize/i.test(r))).toBe(true);
    });

    it('confidence higher with more cases', () => {
      const few = predictOrganizerRetentionRisk(makeOrganizerInput({ casesHandled: 5 }));
      const many = predictOrganizerRetentionRisk(makeOrganizerInput({ casesHandled: 20 }));
      expect(many.confidence).toBeGreaterThan(few.confidence);
    });
  });

  describe('batchPredictPilotSuccess', () => {
    it('returns results for all inputs', () => {
      const inputs = [makePilotInput(), makePilotInput({ memberCount: 50 })];
      const results = batchPredictPilotSuccess(inputs);
      expect(results).toHaveLength(2);
    });

    it('each result has input and prediction', () => {
      const results = batchPredictPilotSuccess([makePilotInput()]);
      expect(results[0]).toHaveProperty('input');
      expect(results[0]).toHaveProperty('prediction');
      expect(results[0].prediction).toHaveProperty('score');
    });

    it('handles empty array', () => {
      expect(batchPredictPilotSuccess([])).toEqual([]);
    });
  });

  describe('type exports', () => {
    it('PredictionResult shape', () => {
      const r: PredictionResult = {
        score: 50,
        confidence: 80,
        interpretation: 'test',
        factors: [],
        recommendations: [],
      };
      expect(r.score).toBe(50);
    });
  });
});
