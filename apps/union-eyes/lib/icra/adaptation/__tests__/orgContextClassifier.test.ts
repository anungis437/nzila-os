/**
 * Determinism + correctness tests for the OCRA adaptation classifier.
 *
 * DOCTRINE: same inputs → same outputs, always.
 */

import { describe, expect, it } from 'vitest';

import { classifyOrgContext } from '../orgContextClassifier';
import type { ClassifierInputs } from '../types';

const RAW_SMALL_LOCAL_UNION: ClassifierInputs = {
  rawForm: {
    ctx_org_type: 'local_union',
    ctx_sector: 'labour_union',
    ctx_membership_size: 'under_100',
    ctx_years_operating: '15_to_29_years',
    ctx_respondent_role: 'self_senior_leader',
  },
};

const RAW_FEDERATION: ClassifierInputs = {
  rawForm: {
    ctx_org_type: 'federation',
    ctx_sector: 'labour_union',
    ctx_membership_size: '50000_plus',
    ctx_years_operating: '30_plus_years',
    ctx_respondent_role: 'self_board_member',
  },
};

const RAW_HEALTH_AUTHORITY: ClassifierInputs = {
  rawForm: {
    ctx_org_type: 'health_authority',
    ctx_sector: 'healthcare',
    ctx_membership_size: '10000_49999',
    ctx_years_operating: '30_plus_years',
    ctx_respondent_role: 'self_senior_leader',
  },
};

const RAW_CONSULTANT_BLANK: ClassifierInputs = {
  rawForm: {
    ctx_respondent_role: 'on_behalf_consultant',
  },
};

describe('orgContextClassifier — determinism', () => {
  it('produces identical profiles for identical inputs (small local union)', () => {
    const a = classifyOrgContext(RAW_SMALL_LOCAL_UNION);
    const b = classifyOrgContext(RAW_SMALL_LOCAL_UNION);
    expect(a).toEqual(b);
  });

  it('produces identical profiles for identical inputs (federation)', () => {
    const a = classifyOrgContext(RAW_FEDERATION);
    const b = classifyOrgContext(RAW_FEDERATION);
    expect(a).toEqual(b);
  });

  it('returns a frozen profile', () => {
    const p = classifyOrgContext(RAW_SMALL_LOCAL_UNION);
    expect(Object.isFrozen(p)).toBe(true);
  });
});

describe('orgContextClassifier — known profiles', () => {
  it('classifies a small local union correctly', () => {
    const p = classifyOrgContext(RAW_SMALL_LOCAL_UNION);
    expect(p.institutionalScale).toBe('micro');
    expect(p.governanceComplexity).toBe('structured');
    expect(p.continuityExposure).toBe('cross_functional');
    expect(p.respondentLens).toBe('senior_decision_maker');
    expect(p.isComplete).toBe(true);
    expect(p.usedConservativeDefault).toBe(false);
  });

  it('classifies a large federation as federated_complex', () => {
    const p = classifyOrgContext(RAW_FEDERATION);
    expect(p.institutionalScale).toBe('federated_complex');
    expect(p.continuityComplexity).toBe('institutional');
    expect(p.governanceComplexity).toBe('federated');
    expect(p.respondentLens).toBe('board_governance');
  });

  it('classifies a health authority as mission_critical + public_accountability', () => {
    const p = classifyOrgContext(RAW_HEALTH_AUTHORITY);
    expect(p.continuityExposure).toBe('mission_critical');
    expect(p.governanceComplexity).toBe('public_accountability');
    expect(p.institutionalScale).toBe('large');
    expect(p.continuityComplexity).toBe('high');
  });
});

describe('orgContextClassifier — conservative defaults', () => {
  it('uses safe defaults when most inputs are missing', () => {
    const p = classifyOrgContext(RAW_CONSULTANT_BLANK);
    expect(p.institutionalScale).toBe('small');
    expect(p.continuityComplexity).toBe('moderate');
    expect(p.governanceComplexity).toBe('simple');
    expect(p.continuityExposure).toBe('localized');
    expect(p.respondentLens).toBe('external_advisor');
    expect(p.usedConservativeDefault).toBe(true);
    expect(p.isComplete).toBe(false);

    // Every defaulted dimension must record a `*_safe_default` rationale.
    const safeDefaultRules = p.rationale.filter((r) =>
      r.ruleId.endsWith('safe_default'),
    );
    expect(safeDefaultRules.length).toBeGreaterThanOrEqual(4);
  });

  it('returns a fully-formed profile even with empty inputs', () => {
    const p = classifyOrgContext({});
    expect(p.doctrineVersion).toBe('1.0.0');
    expect(p.usedConservativeDefault).toBe(true);
    expect(p.rationale.length).toBe(5); // one per dimension
  });
});

describe('orgContextClassifier — canonical context path', () => {
  it('accepts a pre-mapped canonical OrganizationContext', () => {
    const p = classifyOrgContext({
      canonicalContext: {
        sector: 'healthcare',
        workforceBand: '1000_4999',
        governanceModel: 'appointed_board',
        respondentRole: 'self_senior_leader',
      },
    });
    expect(p.institutionalScale).toBe('large');
    expect(p.governanceComplexity).toBe('public_accountability');
    expect(p.continuityExposure).toBe('mission_critical');
    expect(p.respondentLens).toBe('senior_decision_maker');
  });
});
