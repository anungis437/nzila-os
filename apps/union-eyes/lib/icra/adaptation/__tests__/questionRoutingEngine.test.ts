/**
 * Routing-engine determinism, precedence, and safe-default tests.
 */

import { describe, expect, it } from 'vitest';

import { classifyOrgContext } from '../orgContextClassifier';
import { routeQuestionBank } from '../questionRoutingEngine';
import type { RoutableQuestion } from '../routingTypes';

// ── Fixture bank ───────────────────────────────────────────────────────────

function q(
  id: string,
  section: string,
  order: number,
  adaptive?: RoutableQuestion['adaptive'],
): RoutableQuestion {
  return { id, section, order, adaptive };
}

// 25 questions: enough to clear the default minIncluded=18 threshold while
// leaving headroom for deferrals.
const CORE_BANK: RoutableQuestion[] = Array.from({ length: 20 }, (_, i) =>
  q(`core_${i}`, 'operational_dependency', i, { weight: 'core' }),
);

const SECTOR_QS: RoutableQuestion[] = [
  q('sector_healthcare_a', 'governance_visibility', 1, {
    weight: 'sector_specific',
    rules: { sectorRelevance: ['healthcare'] },
  }),
  q('sector_healthcare_b', 'governance_visibility', 2, {
    weight: 'sector_specific',
    rules: { sectorRelevance: ['healthcare'] },
  }),
];

const SCALE_QS: RoutableQuestion[] = [
  q('only_micro', 'institutional_memory', 1, {
    weight: 'scale_specific',
    rules: {
      requiredFor: [{ field: 'institutionalScale', value: 'micro' }],
      suppressedFor: [
        { field: 'institutionalScale', value: 'enterprise' },
        { field: 'institutionalScale', value: 'federated_complex' },
      ],
    },
  }),
  q('floor_high', 'institutional_memory', 2, {
    weight: 'governance_specific',
    rules: { minOrgComplexity: 'high' },
  }),
];

const FULL_BANK = [...CORE_BANK, ...SECTOR_QS, ...SCALE_QS];

const PROFILE_HEALTH_LARGE = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'health_authority',
    ctx_sector: 'healthcare',
    ctx_membership_size: '10000_49999',
    ctx_years_operating: '30_plus_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

const PROFILE_MICRO_UNION = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'local_union',
    ctx_sector: 'labour_union',
    ctx_membership_size: 'under_100',
    ctx_years_operating: 'under_5_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('questionRoutingEngine — determinism', () => {
  it('produces identical RoutedQuestionBank for identical inputs', () => {
    const a = routeQuestionBank(FULL_BANK, PROFILE_HEALTH_LARGE);
    const b = routeQuestionBank(FULL_BANK, PROFILE_HEALTH_LARGE);
    expect(a).toEqual(b);
  });

  it('returns a frozen routed bank', () => {
    const r = routeQuestionBank(FULL_BANK, PROFILE_HEALTH_LARGE);
    expect(Object.isFrozen(r)).toBe(true);
  });
});

describe('questionRoutingEngine — inclusion + deferral semantics', () => {
  it('always includes core questions regardless of profile', () => {
    const r = routeQuestionBank(FULL_BANK, PROFILE_HEALTH_LARGE);
    for (const cq of CORE_BANK) {
      expect(r.includedQuestions.find((x) => x.id === cq.id)).toBeDefined();
    }
  });

  it('includes sector-specific questions when sector matches', () => {
    const r = routeQuestionBank(FULL_BANK, PROFILE_HEALTH_LARGE);
    expect(r.includedQuestions.find((x) => x.id === 'sector_healthcare_a')).toBeDefined();
    expect(r.includedQuestions.find((x) => x.id === 'sector_healthcare_b')).toBeDefined();
  });

  it('defers sector-specific questions when sector does not match', () => {
    const r = routeQuestionBank(FULL_BANK, PROFILE_MICRO_UNION);
    expect(r.deferredQuestions.find((x) => x.id === 'sector_healthcare_a')).toBeDefined();
    const rationale = r.routingRationale.find((x) => x.questionId === 'sector_healthcare_a');
    expect(rationale?.decision).toBe('defer_out_of_scope');
  });

  it('suppressedFor wins over requiredFor', () => {
    const fed = classifyOrgContext({
      rawForm: {
        ctx_org_type: 'federation',
        ctx_sector: 'labour_union',
        ctx_membership_size: '50000_plus',
        ctx_years_operating: '30_plus_years',
        ctx_respondent_role: 'self_board_member',
      },
    });
    const r = routeQuestionBank(FULL_BANK, fed);
    const rationale = r.routingRationale.find((x) => x.questionId === 'only_micro');
    expect(rationale?.decision).toBe('defer_suppressed');
  });

  it('enforces complexity floor (defers when below)', () => {
    const r = routeQuestionBank(FULL_BANK, PROFILE_MICRO_UNION);
    const rationale = r.routingRationale.find((x) => x.questionId === 'floor_high');
    expect(rationale?.decision).toBe('defer_complexity_floor');
  });
});

describe('questionRoutingEngine — safe defaults', () => {
  it('falls back to full bank when profile used a conservative default', () => {
    const partial = classifyOrgContext({ rawForm: {} });
    const r = routeQuestionBank(FULL_BANK, partial);
    expect(r.usedSafeDefault).toBe(true);
    expect(r.includedQuestions.length).toBe(FULL_BANK.length);
    expect(r.deferredQuestions.length).toBe(0);
  });

  it('falls back to full bank when routed set is below minIncluded threshold', () => {
    const tinyBank: RoutableQuestion[] = [
      q('only_healthcare', 'a', 1, {
        weight: 'sector_specific',
        rules: { sectorRelevance: ['healthcare'] },
      }),
      q('only_union', 'a', 2, {
        weight: 'sector_specific',
        rules: { sectorRelevance: ['labour_union'] },
      }),
    ];
    const r = routeQuestionBank(tinyBank, PROFILE_HEALTH_LARGE, {
      minIncludedQuestions: 5,
    });
    expect(r.usedSafeDefault).toBe(true);
    expect(r.includedQuestions.length).toBe(tinyBank.length);
  });
});

describe('questionRoutingEngine — fingerprint privacy', () => {
  it('selectionFingerprint contains only counts + section ids (no PII)', () => {
    const r = routeQuestionBank(FULL_BANK, PROFILE_HEALTH_LARGE);
    expect(r.selectionFingerprint).toMatch(/^\d+\|c\d+r\d+m\d+x\d+\|/);
    expect(r.selectionFingerprint.length).toBeLessThanOrEqual(256);
  });
});

describe('questionRoutingEngine — no-metadata questions', () => {
  it('treats questions with no adaptive metadata as core', () => {
    const mixed: RoutableQuestion[] = [
      ...CORE_BANK.slice(0, 18),
      q('no_meta_1', 'extra', 1), // no adaptive field at all
      q('no_meta_2', 'extra', 2),
    ];
    const r = routeQuestionBank(mixed, PROFILE_HEALTH_LARGE);
    expect(r.includedQuestions.find((x) => x.id === 'no_meta_1')).toBeDefined();
    const rationale = r.routingRationale.find((x) => x.questionId === 'no_meta_1');
    expect(rationale?.ruleId).toBe('eligibility.no_metadata_defaults_core');
  });
});
