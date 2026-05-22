/**
 * Adaptive narrative + facilitator-guide tests.
 *
 * DOCTRINE invariants asserted here:
 *  - Bilingual parity: every passage in the library exists in en-CA and fr-CA.
 *  - Determinism: same inputs ⇒ same bundle.
 *  - Dignity: no shaming language for small orgs, no flattery for large.
 *  - Visibility: facilitator guide enumerates every adaptive decision.
 *  - Privacy: bundle fingerprint contains only enum tokens, no PII.
 */

import { describe, expect, it } from 'vitest';

import { adaptScoring } from '../adaptiveScoringModel';
import {
  buildAdaptiveNarrative,
  type AdaptiveNarrativeBundle,
} from '../adaptiveNarrativeEngine';
import {
  _PASSAGE_TABLES,
  type SupportedLocale,
} from '../adaptivePassageLibrary';
import { buildFacilitatorGuide } from '../facilitatorAdaptationGuide';
import { classifyOrgContext } from '../orgContextClassifier';
import { routeQuestionBank } from '../questionRoutingEngine';
import type {
  ContinuityObservation,
  InstitutionalContinuityProfile,
  MaturityBand,
} from '../../types';
import type { RoutableQuestion } from '../routingTypes';

const STUB_BAND: MaturityBand = {
  id: 'structured_governance',
  ordinal: 3,
  name: 'Structured Governance',
  ociBandName: 'Structured Continuity',
  operationalPattern: 'Process-driven',
  summary: 'stub',
  operationalCharacteristics: [],
  governanceImplications: [],
  continuityImplications: [],
  minComposite: 50,
};

function buildRawProfile(
  overrides: Partial<InstitutionalContinuityProfile> = {},
): InstitutionalContinuityProfile {
  return {
    assessmentId: 'stub-assessment',
    generatedAt: '2026-05-22T00:00:00.000Z',
    maturityBand: STUB_BAND,
    composite: 60,
    dimensions: [],
    sections: [],
    observations: [],
    recommendations: [],
    answeredQuestionCount: 32,
    questionBankVersion: 3,
    ...overrides,
  };
}

const PROFILE_MICRO = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'local_union',
    ctx_sector: 'labour_union',
    ctx_membership_size: 'under_100',
    ctx_years_operating: '5_to_14_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

const PROFILE_HEALTH = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'health_authority',
    ctx_sector: 'healthcare',
    ctx_membership_size: '10000_49999',
    ctx_years_operating: '30_plus_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

const PROFILE_ADVISOR = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'national_union',
    ctx_sector: 'labour_union',
    ctx_membership_size: '500_to_4999',
    ctx_years_operating: '15_to_29_years',
    ctx_respondent_role: 'on_behalf_consultant',
  },
});

describe('adaptivePassageLibrary — bilingual parity', () => {
  const locales: readonly SupportedLocale[] = ['en-CA', 'fr-CA'];

  it('every scale opener has both locales and non-empty strings', () => {
    for (const [key, passage] of Object.entries(_PASSAGE_TABLES.SCALE_OPENERS)) {
      for (const loc of locales) {
        expect(passage[loc], `${key}/${loc}`).toBeTruthy();
        expect(passage[loc].length).toBeGreaterThan(40);
      }
    }
  });

  it('every governance framing has both locales', () => {
    for (const [key, passage] of Object.entries(
      _PASSAGE_TABLES.GOVERNANCE_FRAMINGS,
    )) {
      for (const loc of locales) {
        expect(passage[loc], `${key}/${loc}`).toBeTruthy();
      }
    }
  });

  it('every exposure framing has both locales', () => {
    for (const [key, passage] of Object.entries(
      _PASSAGE_TABLES.EXPOSURE_FRAMINGS,
    )) {
      for (const loc of locales) {
        expect(passage[loc], `${key}/${loc}`).toBeTruthy();
      }
    }
  });

  it('every non-null respondent caveat has both locales', () => {
    for (const [key, passage] of Object.entries(
      _PASSAGE_TABLES.RESPONDENT_CAVEATS,
    )) {
      if (passage === null) continue;
      for (const loc of locales) {
        expect(passage[loc], `${key}/${loc}`).toBeTruthy();
      }
    }
  });
});

describe('adaptivePassageLibrary — dignity discipline', () => {
  it('small/micro openers do not use shaming language', () => {
    const forbidden = [
      /immature/i,
      /amateur/i,
      /unsophisticat/i,
      /lack of professionalism/i,
      /naive/i,
    ];
    for (const key of ['micro', 'small'] as const) {
      const passage = _PASSAGE_TABLES.SCALE_OPENERS[key];
      for (const loc of ['en-CA', 'fr-CA'] as const) {
        for (const re of forbidden) {
          expect(passage[loc], `${key}/${loc} contains ${re}`).not.toMatch(re);
        }
      }
    }
  });

  it('large/enterprise openers do not use flattering language', () => {
    const forbidden = [/sophisticated/i, /world-class/i, /best-in-class/i, /elite/i];
    for (const key of ['large', 'enterprise'] as const) {
      const passage = _PASSAGE_TABLES.SCALE_OPENERS[key];
      for (const loc of ['en-CA', 'fr-CA'] as const) {
        for (const re of forbidden) {
          expect(passage[loc], `${key}/${loc} contains ${re}`).not.toMatch(re);
        }
      }
    }
  });
});

describe('buildAdaptiveNarrative', () => {
  it('produces a deterministic, frozen bundle', () => {
    const raw = buildRawProfile({ composite: 70 });
    const result = adaptScoring(raw, PROFILE_HEALTH);
    const a = buildAdaptiveNarrative(result, 'en-CA');
    const b = buildAdaptiveNarrative(result, 'en-CA');
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('uses the locale-appropriate scale opener', () => {
    const raw = buildRawProfile({ composite: 70 });
    const result = adaptScoring(raw, PROFILE_HEALTH);
    const en = buildAdaptiveNarrative(result, 'en-CA');
    const fr = buildAdaptiveNarrative(result, 'fr-CA');
    expect(en.scaleOpener).not.toBe(fr.scaleOpener);
    expect(en.scaleOpener).toMatch(/institution/i);
    expect(fr.scaleOpener).toMatch(/institution/i);
  });

  it('emits a respondent caveat for external_advisor', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_ADVISOR);
    const bundle = buildAdaptiveNarrative(result, 'en-CA');
    expect(bundle.respondentCaveat).toBeTruthy();
    expect(bundle.respondentCaveat).toMatch(/advis/i);
  });

  it('emits no respondent caveat for inside_operator', () => {
    // build by direct overrides since classifyOrgContext does not surface inside_operator yet
    const result = adaptScoring(buildRawProfile(), {
      ...PROFILE_HEALTH,
      respondentLens: 'inside_operator',
    });
    const bundle = buildAdaptiveNarrative(result, 'en-CA');
    expect(bundle.respondentCaveat).toBeNull();
  });

  it('fingerprint contains only low-cardinality enum tokens', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_HEALTH);
    const bundle: AdaptiveNarrativeBundle = buildAdaptiveNarrative(
      result,
      'en-CA',
    );
    // Must not contain any UUIDs, emails, or free text.
    expect(bundle.bundleFingerprint).not.toMatch(/@/);
    expect(bundle.bundleFingerprint).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(bundle.bundleFingerprint.split('|').length).toBe(6);
  });
});

describe('buildFacilitatorGuide', () => {
  const sampleBank: RoutableQuestion[] = [
    { id: 'q1', section: 's1', order: 1 },
    { id: 'q2', section: 's1', order: 2 },
    {
      id: 'q3',
      section: 's2',
      order: 1,
      adaptive: {
        weight: 'required',
        purpose: 'risk_signal',
      },
    },
  ];

  it('marks routedSafely=true when routing did not fall back', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_HEALTH);
    const routed = routeQuestionBank(sampleBank, PROFILE_HEALTH, {
      minIncludedQuestions: 1,
    });
    const guide = buildFacilitatorGuide(result, routed);
    expect(guide.routedSafely).toBe(!routed.usedSafeDefault);
  });

  it('enumerates interpretation cautions for external advisors', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_ADVISOR);
    const guide = buildFacilitatorGuide(result, null);
    expect(
      guide.interpretationCautions.some((c) => /advisor/i.test(c) || /advis/i.test(c)),
    ).toBe(true);
  });

  it('enumerates small-scale interpretation caution', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_MICRO);
    const guide = buildFacilitatorGuide(result, null);
    expect(
      guide.interpretationCautions.some((c) => /small-scale/i.test(c)),
    ).toBe(true);
  });

  it('enumerates mission-critical interpretation caution', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_HEALTH);
    const guide = buildFacilitatorGuide(result, null);
    expect(
      guide.interpretationCautions.some((c) => /mission-critical/i.test(c)),
    ).toBe(true);
  });

  it('profileBand is low-cardinality and contains no PII', () => {
    const raw = buildRawProfile();
    const result = adaptScoring(raw, PROFILE_HEALTH);
    const guide = buildFacilitatorGuide(result, null);
    expect(guide.profileBand.split('|').length).toBe(5);
    expect(guide.profileBand).not.toMatch(/@/);
  });

  it('includes warning_filter rationale when warnings were filtered', () => {
    const obs: ContinuityObservation = {
      id: 'multi_region_runtime_governance',
      severity: 'attention',
      category: 'governance',
      statement: 'Multi-site runtime governance is not yet established.',
    };
    const raw = buildRawProfile({ observations: [obs] });
    const result = adaptScoring(raw, PROFILE_MICRO);
    const guide = buildFacilitatorGuide(result, null);
    expect(
      guide.adaptationDecisions.some((d) => d.area === 'warning_filter'),
    ).toBe(true);
  });
});
