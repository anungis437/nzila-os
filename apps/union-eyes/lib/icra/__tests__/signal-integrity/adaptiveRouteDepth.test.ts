/**
 * Question Architecture Audit™ — Adaptive Routing Depth test
 *
 * Audit reference: docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md
 *
 * Enforces:
 *  - Safe-default floor (>= 18 routed questions).
 *  - The full bank exceeds the safe-default floor by a healthy margin.
 *  - No routing rule references demographic profile fields *only* in v1.
 *
 * Aspirational invariants (Jaccard distance across distinct profiles,
 * median routed-bank size >= 28) are documented as `.todo` because the
 * v1.2.0 metadata population sprint enables them.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';
import { classifyOrgContext } from '../../adaptation/orgContextClassifier';
import { routeQuestionBank } from '../../adaptation/questionRoutingEngine';
import type { InstitutionalAssessmentProfile } from '../../adaptation/types';

const SAFE_DEFAULT_FLOOR = 18;

function jaccardDistance(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((v) => setB.has(v)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : 1 - intersection / union;
}

function featureVector(p: InstitutionalAssessmentProfile): string[] {
  return [
    `scale:${p.institutionalScale}`,
    `complexity:${p.continuityComplexity}`,
    `governance:${p.governanceComplexity}`,
    `exposure:${p.continuityExposure}`,
    `lens:${p.respondentLens}`,
  ];
}

const PROFILE_FIXTURES = [
  {
    ctx_org_type: 'local_union',
    ctx_sector: 'public_sector',
    ctx_membership_size: '100_499',
    ctx_years_operating: '30_plus',
    ctx_respondent_role: 'self_staff',
  },
  {
    ctx_org_type: 'federation',
    ctx_sector: 'healthcare',
    ctx_membership_size: '50000_plus',
    ctx_years_operating: '30_plus',
    ctx_respondent_role: 'self_board_member',
  },
  {
    ctx_org_type: 'owner_operated_sme',
    ctx_sector: 'private_sector',
    ctx_membership_size: 'under_100',
    ctx_years_operating: 'under_5',
    ctx_respondent_role: 'on_behalf_consultant',
  },
  {
    ctx_org_type: 'government_agency',
    ctx_sector: 'education',
    ctx_membership_size: '10000_49999',
    ctx_years_operating: '15_29',
    ctx_respondent_role: 'self_senior_leader',
  },
  {
    ctx_org_type: 'cooperative',
    ctx_sector: 'transportation',
    ctx_membership_size: '2000_9999',
    ctx_years_operating: '5_14',
    ctx_respondent_role: 'on_behalf_counsel',
  },
] as const;

describe('Question Architecture Audit™ — adaptive routing depth', () => {
  it('the full bank exceeds the safe-default floor', () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThan(SAFE_DEFAULT_FLOOR);
  });

  it('the full bank is large enough to support median routed size >= 28', () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThanOrEqual(28);
  });

  it('every question declares a weight class consistent with routing semantics', () => {
    const allowed = new Set(['core', 'required', 'recommended', 'contextual']);
    for (const q of ALL_QUESTIONS) {
      const w = (q as { weight?: string }).weight ?? 'core';
      expect(allowed.has(w), `${q.id} has unexpected weight: ${w}`).toBe(true);
    }
  });

  it('Jaccard distance between any two distinct InstitutionalAssessmentProfile classifications >= 0.15', () => {
    const profiles = PROFILE_FIXTURES.map((rawForm) => classifyOrgContext({ rawForm }));
    const seen = new Set(profiles.map((p) => featureVector(p).join('|')));
    expect(seen.size).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = featureVector(profiles[i]);
        const b = featureVector(profiles[j]);
        if (a.join('|') === b.join('|')) continue;
        const d = jaccardDistance(a, b);
        expect(d, `profiles ${i} vs ${j} distance=${d}`).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('median routed-bank size across realistic profile matrix >= 28', () => {
    const routedSizes = PROFILE_FIXTURES.map((rawForm) => {
      const profile = classifyOrgContext({ rawForm });
      const routed = routeQuestionBank(ALL_QUESTIONS, profile);
      return routed.includedQuestions.length;
    }).sort((a, b) => a - b);

    const median = routedSizes[Math.floor(routedSizes.length / 2)];
    expect(median).toBeGreaterThanOrEqual(28);
    expect(median).toBeLessThanOrEqual(ALL_QUESTIONS.length);
  });

  it('no suppressedFor / requiredFor / recommendedFor rule references demographic fields without a structural co-criterion', () => {
    const demographicFields = new Set(['sectorRelevance', 'sizeRelevance', 'governanceRelevance', 'respondentRelevance']);
    const profiledQuestions = ALL_QUESTIONS as Array<
      typeof ALL_QUESTIONS[number] & {
        adaptive?: {
          rules?: {
            suppressedFor?: any[];
            requiredFor?: any[];
            recommendedFor?: any[];
            minOrgComplexity?: string;
            maxOrgComplexity?: string;
            sectorRelevance?: any[];
            sizeRelevance?: any[];
            governanceRelevance?: any[];
            respondentRelevance?: any[];
          };
        };
      }
    >;

    for (const q of profiledQuestions) {
      const rules = q.adaptive?.rules;
      if (!rules) continue;

      const hasDemographicSelector = Object.entries(rules)
        .filter(([k, v]) => demographicFields.has(k) && Array.isArray(v) && v.length > 0)
        .length > 0;
      if (!hasDemographicSelector) continue;

      const hasStructuralCoCriterion =
        Boolean(rules.minOrgComplexity || rules.maxOrgComplexity) ||
        (Array.isArray(rules.requiredFor) && rules.requiredFor.length > 0) ||
        (Array.isArray(rules.recommendedFor) && rules.recommendedFor.length > 0) ||
        (Array.isArray(rules.suppressedFor) && rules.suppressedFor.length > 0);

      expect(hasStructuralCoCriterion, `${q.id}: demographic selector without structural co-criterion`).toBe(true);
    }
  });
});
