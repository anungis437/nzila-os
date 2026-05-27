/**
 * ICRA → HubSpot property mapper tests.
 *
 * Pure deterministic tests — no network, no DB, no time. Covers:
 *   • Maturity band labels (all 5)
 *   • Burden bucket boundaries (Low / Moderate / Elevated / Severe)
 *   • Persona labels (all 6)
 *   • Posture derivations (governance entropy, stewardship concentration,
 *     dependency risk, modernization alignment) at boundary scores
 *   • Contact / company payload shape — only known keys, no PII leakage
 *   • Idempotency — same input → exact same output, twice
 */

import { describe, it, expect } from 'vitest';
import type {
  InstitutionalContinuityProfile,
  MaturityBand,
  MaturityBandId,
} from '@/lib/icra/types';
import {
  ICRA_CONTACT_PROPERTIES,
  ICRA_COMPANY_PROPERTIES,
  ICRA_DEAL_STAGES,
  MATURITY_BAND_LABELS,
  PERSONA_LABELS,
  REPORT_TIER_LABELS,
  buildCompanyProperties,
  buildContactProperties,
  mapBurdenLevel,
  mapGovernanceComplexity,
  mapGovernanceEntropy,
  mapInstitutionalDependencyRisk,
  mapModernizationAlignment,
  mapStewardshipConcentration,
} from '../icraPropertyMapper';

function band(id: MaturityBandId): MaturityBand {
  return {
    id,
    ordinal: 3,
    name: id,
    ociBandName: 'Structured Continuity',
    operationalPattern: 'Structured Governance',
    summary: '',
    operationalCharacteristics: [],
    governanceImplications: [],
    continuityImplications: [],
    minComposite: 50,
  };
}

function makeProfile(
  overrides: Partial<InstitutionalContinuityProfile> = {},
): InstitutionalContinuityProfile {
  return {
    assessmentId: 'a1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    maturityBand: band('structured_governance'),
    composite: 60,
    dimensions: [
      { dimension: 'institutional_continuity', score: 60, contributingQuestions: 5, weightTotal: 5 },
      { dimension: 'governance_fragility', score: 60, contributingQuestions: 5, weightTotal: 5 },
      { dimension: 'trust_debt', score: 60, contributingQuestions: 5, weightTotal: 5 },
      { dimension: 'operational_memory', score: 60, contributingQuestions: 5, weightTotal: 5 },
      { dimension: 'transition_readiness', score: 60, contributingQuestions: 5, weightTotal: 5 },
    ],
    sections: [],
    observations: [],
    recommendations: [],
    answeredQuestionCount: 40,
    questionBankVersion: 1,
    burdenIndex: {
      score: 40,
      interpretation: '',
      humanCompensationIndicators: [],
    },
    reportTierId: 'executive_continuity_brief',
    ...overrides,
  };
}

describe('icraPropertyMapper — enum tables', () => {
  it('has display labels for all 5 maturity bands', () => {
    const ids: MaturityBandId[] = [
      'personality_dependent',
      'fragmented_coordination',
      'structured_governance',
      'continuity_aware',
      'continuity_intelligence',
    ];
    for (const id of ids) {
      expect(MATURITY_BAND_LABELS[id]).toBeTruthy();
    }
  });

  it('has labels for all 6 executive personas', () => {
    expect(Object.keys(PERSONA_LABELS)).toHaveLength(6);
  });

  it('has labels for all 3 report tiers', () => {
    expect(REPORT_TIER_LABELS.continuity_reflection).toBe('Free Readiness Check');
    expect(REPORT_TIER_LABELS.executive_continuity_brief).toBe('Leadership Briefing Report');
    expect(REPORT_TIER_LABELS.institutional_continuity_diagnostic).toBe(
      'Institutional Continuity Diagnostic',
    );
  });

  it('defines all 7 OCI pipeline stages', () => {
    expect(Object.keys(ICRA_DEAL_STAGES)).toHaveLength(7);
  });
});

describe('mapBurdenLevel — institutional bucket boundaries', () => {
  it.each([
    [0, 'Low'],
    [29, 'Low'],
    [30, 'Moderate'],
    [54, 'Moderate'],
    [55, 'Elevated'],
    [74, 'Elevated'],
    [75, 'Severe'],
    [100, 'Severe'],
    [-10, 'Low'], // clamp
    [200, 'Severe'], // clamp
  ])('score %i → %s', (score, expected) => {
    expect(mapBurdenLevel(score)).toBe(expected);
  });
});

describe('posture mappers — risk-band derivations', () => {
  it('governance entropy: fragile (low score) → Elevated', () => {
    const p = makeProfile({
      dimensions: [
        { dimension: 'governance_fragility', score: 30, contributingQuestions: 1, weightTotal: 1 },
      ],
    });
    expect(mapGovernanceEntropy(p)).toBe('Elevated');
  });

  it('stewardship concentration: high burden → Elevated', () => {
    const p = makeProfile({
      burdenIndex: { score: 80, interpretation: '', humanCompensationIndicators: [] },
    });
    expect(mapStewardshipConcentration(p)).toBe('Elevated');
  });

  it('institutional dependency risk: weak memory + transition → Elevated', () => {
    const p = makeProfile({
      dimensions: [
        { dimension: 'operational_memory', score: 25, contributingQuestions: 1, weightTotal: 1 },
        { dimension: 'transition_readiness', score: 30, contributingQuestions: 1, weightTotal: 1 },
      ],
    });
    expect(mapInstitutionalDependencyRisk(p)).toBe('Elevated');
  });

  it('modernization alignment: large IC-OM gap → Misaligned', () => {
    const p = makeProfile({
      dimensions: [
        { dimension: 'institutional_continuity', score: 80, contributingQuestions: 1, weightTotal: 1 },
        { dimension: 'operational_memory', score: 50, contributingQuestions: 1, weightTotal: 1 },
      ],
    });
    expect(mapModernizationAlignment(p)).toBe('Misaligned');
  });

  it('modernization alignment: tight gap → Aligned', () => {
    const p = makeProfile({
      dimensions: [
        { dimension: 'institutional_continuity', score: 60, contributingQuestions: 1, weightTotal: 1 },
        { dimension: 'operational_memory', score: 58, contributingQuestions: 1, weightTotal: 1 },
      ],
    });
    expect(mapModernizationAlignment(p)).toBe('Aligned');
  });

  it('governance complexity (company): weak governance + trust debt → High', () => {
    const p = makeProfile({
      dimensions: [
        { dimension: 'governance_fragility', score: 30, contributingQuestions: 1, weightTotal: 1 },
        { dimension: 'trust_debt', score: 30, contributingQuestions: 1, weightTotal: 1 },
      ],
    });
    expect(mapGovernanceComplexity(p)).toBe('High');
  });
});

describe('buildContactProperties — payload contract', () => {
  it('emits only known property keys', () => {
    const p = makeProfile();
    const props = buildContactProperties(p, { persona: 'executive_director' });
    const allowed = new Set(Object.values(ICRA_CONTACT_PROPERTIES));
    for (const key of Object.keys(props)) {
      expect(allowed.has(key as (typeof ICRA_CONTACT_PROPERTIES)[keyof typeof ICRA_CONTACT_PROPERTIES])).toBe(true);
    }
  });

  it('includes persona only when provided (no inference)', () => {
    const p = makeProfile();
    const withPersona = buildContactProperties(p, { persona: 'union_leadership' });
    const withoutPersona = buildContactProperties(p);
    expect(withPersona[ICRA_CONTACT_PROPERTIES.persona]).toBe('Union Leadership');
    expect(withoutPersona[ICRA_CONTACT_PROPERTIES.persona]).toBeUndefined();
  });

  it('captures UTM only when voluntarily present (no fabrication)', () => {
    const p = makeProfile();
    const withUtm = buildContactProperties(p, {
      attribution: { utmSource: 'newsletter', utmCampaign: 'q1_brief' },
    });
    expect(withUtm[ICRA_CONTACT_PROPERTIES.utmSource]).toBe('newsletter');
    expect(withUtm[ICRA_CONTACT_PROPERTIES.utmCampaign]).toBe('q1_brief');
    expect(withUtm[ICRA_CONTACT_PROPERTIES.utmMedium]).toBeUndefined();
  });

  it('is deterministic — same input produces identical output across calls', () => {
    const p = makeProfile();
    const a = buildContactProperties(p, { persona: 'cio_coo' });
    const b = buildContactProperties(p, { persona: 'cio_coo' });
    expect(a).toEqual(b);
  });

  it('does not leak free-text observations or recommendations into HubSpot payload', () => {
    const p = makeProfile({
      observations: [
        {
          id: 'o1',
          severity: 'material',
          category: 'governance',
          statement: 'sensitive narrative about internal politics',
          evidence: ['secret'],
        },
      ],
    });
    const props = buildContactProperties(p);
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain('sensitive narrative');
    expect(serialized).not.toContain('secret');
  });
});

describe('buildCompanyProperties — payload contract', () => {
  it('emits only known company-level property keys', () => {
    const p = makeProfile();
    const props = buildCompanyProperties(p);
    const allowed = new Set(Object.values(ICRA_COMPANY_PROPERTIES));
    for (const key of Object.keys(props)) {
      expect(allowed.has(key as (typeof ICRA_COMPANY_PROPERTIES)[keyof typeof ICRA_COMPANY_PROPERTIES])).toBe(true);
    }
  });

  it('is deterministic across repeated calls', () => {
    const p = makeProfile();
    expect(buildCompanyProperties(p)).toEqual(buildCompanyProperties(p));
  });
});
