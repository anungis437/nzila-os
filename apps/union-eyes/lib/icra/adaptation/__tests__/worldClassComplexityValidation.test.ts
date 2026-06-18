import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import { classifyOrgContext } from '../orgContextClassifier';
import { routeQuestionBank } from '../questionRoutingEngine';
import type { RoutableQuestion } from '../routingTypes';

function question(
  id: string,
  order: number,
  adaptive?: RoutableQuestion['adaptive'],
): RoutableQuestion {
  return {
    id,
    section: 'operational_dependency',
    order,
    adaptive,
  };
}

const ADAPTIVE_VALIDATION_BANK: readonly RoutableQuestion[] = [
  ...Array.from({ length: 18 }, (_, i) =>
    question(`core_${i + 1}`, i + 1, { weight: 'core' }),
  ),
  question('floor_moderate', 19, {
    weight: 'contextual',
    rules: { minOrgComplexity: 'moderate' },
  }),
  question('floor_elevated', 20, {
    weight: 'contextual',
    rules: { minOrgComplexity: 'elevated' },
  }),
  question('floor_high', 21, {
    weight: 'contextual',
    rules: { minOrgComplexity: 'high' },
  }),
  question('floor_organizational', 22, {
    weight: 'contextual',
    rules: { minOrgComplexity: 'organizational' },
  }),
  question('scale_enterprise', 23, {
    weight: 'scale_specific',
    rules: {
      requiredFor: [{ field: 'institutionalScale', value: 'enterprise' }],
      suppressedFor: [
        { field: 'institutionalScale', value: 'micro' },
        { field: 'institutionalScale', value: 'small' },
        { field: 'institutionalScale', value: 'mid_sized' },
        { field: 'institutionalScale', value: 'large' },
        { field: 'institutionalScale', value: 'federated_complex' },
      ],
    },
  }),
  question('scale_federated', 24, {
    weight: 'scale_specific',
    rules: {
      requiredFor: [{ field: 'institutionalScale', value: 'federated_complex' }],
      suppressedFor: [
        { field: 'institutionalScale', value: 'micro' },
        { field: 'institutionalScale', value: 'small' },
        { field: 'institutionalScale', value: 'mid_sized' },
        { field: 'institutionalScale', value: 'large' },
        { field: 'institutionalScale', value: 'enterprise' },
      ],
    },
  }),
];

const COMPLEXITY_LADDER = [
  {
    id: 'micro',
    input: {
      canonicalContext: {
        sector: 'public_sector',
        workforceBand: 'under_50' as const,
        governanceModel: 'elected_board' as const,
        respondentRole: 'self_senior_leader' as const,
      },
      extras: { organizationAge: 'under_5_years' as const },
    },
    expectedScale: 'micro',
    expectedComplexity: 'low',
    expectedIncluded: 18,
  },
  {
    id: 'small',
    input: {
      canonicalContext: {
        sector: 'public_sector',
        workforceBand: '50_249' as const,
        governanceModel: 'elected_board' as const,
        respondentRole: 'self_senior_leader' as const,
      },
      extras: { organizationAge: '5_to_14_years' as const },
    },
    expectedScale: 'small',
    expectedComplexity: 'moderate',
    expectedIncluded: 19,
  },
  {
    id: 'mid',
    input: {
      canonicalContext: {
        sector: 'public_sector',
        workforceBand: '250_999' as const,
        governanceModel: 'elected_board' as const,
        respondentRole: 'self_senior_leader' as const,
      },
      extras: { organizationAge: '15_to_29_years' as const },
    },
    expectedScale: 'mid_sized',
    expectedComplexity: 'elevated',
    expectedIncluded: 20,
  },
  {
    id: 'large',
    input: {
      canonicalContext: {
        sector: 'public_sector',
        workforceBand: '1000_4999' as const,
        governanceModel: 'elected_board' as const,
        respondentRole: 'self_senior_leader' as const,
      },
      extras: { organizationAge: '30_plus_years' as const },
    },
    expectedScale: 'large',
    expectedComplexity: 'high',
    expectedIncluded: 21,
  },
  {
    id: 'enterprise',
    input: {
      canonicalContext: {
        sector: 'public_sector',
        workforceBand: '5000_plus' as const,
        governanceModel: 'elected_board' as const,
        respondentRole: 'self_senior_leader' as const,
      },
      extras: { organizationAge: '30_plus_years' as const },
    },
    expectedScale: 'enterprise',
    expectedComplexity: 'high',
    expectedIncluded: 22,
  },
  {
    id: 'federated',
    input: {
      canonicalContext: {
        sector: 'public_sector',
        workforceBand: '5000_plus' as const,
        governanceModel: 'elected_board' as const,
        federationAffiliation: 'present',
        respondentRole: 'self_senior_leader' as const,
      },
      extras: { organizationAge: '30_plus_years' as const },
    },
    expectedScale: 'federated_complex',
    expectedComplexity: 'organizational',
    expectedIncluded: 23,
  },
] as const;

const COMPLEXITY_RANK: Record<(typeof COMPLEXITY_LADDER)[number]['expectedComplexity'], number> = {
  low: 0,
  moderate: 1,
  elevated: 2,
  high: 3,
  organizational: 4,
};

describe('OCRA world-class complexity validation', () => {
  it('classifies a smallest-to-most-complex ladder with no conservative defaults', () => {
    const observedRanks: number[] = [];

    for (const rung of COMPLEXITY_LADDER) {
      const profile = classifyOrgContext(rung.input);
      expect(profile.institutionalScale).toBe(rung.expectedScale);
      expect(profile.continuityComplexity).toBe(rung.expectedComplexity);
      expect(profile.usedConservativeDefault).toBe(false);
      expect(profile.isComplete).toBe(true);
      observedRanks.push(COMPLEXITY_RANK[profile.continuityComplexity]);
    }

    for (let i = 1; i < observedRanks.length; i += 1) {
      expect(observedRanks[i]).toBeGreaterThanOrEqual(observedRanks[i - 1] ?? -1);
    }
  });

  it('discriminates routing value across the complexity ladder with deterministic fingerprints', () => {
    const observedFingerprints = new Set<string>();

    for (const rung of COMPLEXITY_LADDER) {
      const profileA = classifyOrgContext(rung.input);
      const profileB = classifyOrgContext(rung.input);

      const routeA = routeQuestionBank(ADAPTIVE_VALIDATION_BANK, profileA);
      const routeB = routeQuestionBank(ADAPTIVE_VALIDATION_BANK, profileB);

      expect(routeA.usedSafeDefault).toBe(false);
      expect(routeA.selectionFingerprint).toBe(routeB.selectionFingerprint);
      expect(routeA.includedQuestions).toEqual(routeB.includedQuestions);
      expect(routeA.includedQuestions).toHaveLength(rung.expectedIncluded);

      observedFingerprints.add(routeA.selectionFingerprint);
    }

    expect(observedFingerprints.size).toBeGreaterThanOrEqual(5);
  });

  it('keeps scoring fair across scale by not changing numeric scores from context alone', () => {
    const answers = buildUniformAnswers(2);

    const micro = scoreAssessment('world-class:micro', answers, {
      ctx_sector: 'public_sector',
      ctx_membership_size: 'under_100',
      ctx_years_operating: 'under_5',
    }).profile;

    const enterprise = scoreAssessment('world-class:enterprise', answers, {
      ctx_sector: 'public_sector',
      ctx_membership_size: '50000_plus',
      ctx_years_operating: '30_plus',
    }).profile;

    expect(micro.composite).toBe(enterprise.composite);
    expect(micro.dimensions).toEqual(enterprise.dimensions);
    expect(micro.sections).toEqual(enterprise.sections);
  });

  it('maintains explainability by emitting all five classifier rationale dimensions', () => {
    const profile = classifyOrgContext(COMPLEXITY_LADDER[5].input);
    const dimensions = new Set(profile.rationale.map((entry) => entry.dimension));

    expect(dimensions).toEqual(
      new Set([
        'institutionalScale',
        'continuityComplexity',
        'governanceComplexity',
        'continuityExposure',
        'respondentLens',
      ]),
    );

    for (const entry of profile.rationale) {
      expect(entry.ruleId.length).toBeGreaterThan(0);
      expect(entry.statement.length).toBeGreaterThan(0);
    }
  });
});
