/**
 * Privacy invariant tests for the OCRA adaptation surface.
 *
 * DOCTRINE: the profile and its rationale must never carry org name, free
 * text, IP, geolocation, device, or any PII. Every adaptive decision must be
 * attributable to a finite, fixed set of declared form fields.
 */

import { describe, expect, it } from 'vitest';

import { classifyOrgContext } from '../orgContextClassifier';
import { profileBandSummary } from '../institutionalProfileLens';

const ALLOWED_RATIONALE_INPUT_KEYS = new Set([
  'workforceBand',
  'institutionalScale',
  'organizationAge',
  'governanceModel',
  'federationAffiliation',
  'sector',
  'respondentRole',
]);

describe('adaptive privacy invariants', () => {
  it('rationale never references free-text or PII keys, even when supplied', () => {
    const p = classifyOrgContext({
      rawForm: {
        ctx_org_type: 'national_union',
        ctx_sector: 'labour_union',
        ctx_membership_size: '2000_9999',
        ctx_years_operating: '30_plus_years',
        ctx_respondent_role: 'self_senior_leader',
        // The following are explicitly NOT consumed by the classifier and
        // must never surface in rationale.
        ctx_primary_challenge: 'we have a problem with internal succession',
        respondent_email: 'leader@example.org',
        respondent_ip: '203.0.113.42',
        org_name: 'Example National Union',
      },
    });

    for (const r of p.rationale) {
      for (const input of r.inputs) {
        expect(ALLOWED_RATIONALE_INPUT_KEYS.has(input.key)).toBe(true);
        // Values must be enum tokens, not free text. We approximate that
        // with a length cap and a no-spaces rule (enum tokens are
        // snake_case or short identifiers).
        expect(input.value.length).toBeLessThanOrEqual(64);
        expect(input.value).not.toMatch(/\s/);
      }
      // Statements may contain spaces (they are human-readable), but they
      // must not contain any of the disallowed values from the input form.
      expect(r.statement).not.toContain('we have a problem');
      expect(r.statement).not.toContain('leader@example.org');
      expect(r.statement).not.toContain('203.0.113.42');
      expect(r.statement).not.toContain('Example National Union');
    }
  });

  it('profileBandSummary is low-cardinality and free-text-free', () => {
    const p = classifyOrgContext({
      rawForm: {
        ctx_org_type: 'local_union',
        ctx_sector: 'labour_union',
        ctx_membership_size: 'under_100',
        ctx_years_operating: '15_to_29_years',
        ctx_respondent_role: 'self_senior_leader',
      },
    });
    const summary = profileBandSummary(p);
    expect(summary.length).toBeLessThanOrEqual(128);
    expect(summary).not.toMatch(/\s/);
    expect(summary.split('|').length).toBe(5);
  });

  it('profile never carries org-name or free-text fields', () => {
    const p = classifyOrgContext({
      rawForm: {
        ctx_org_type: 'crown_corp',
        ctx_sector: 'crown_corporation',
        ctx_membership_size: '500_1999',
        ctx_years_operating: '30_plus_years',
        ctx_respondent_role: 'on_behalf_counsel',
        org_name: 'Acme Crown Corporation',
        ctx_primary_challenge: 'free text concern',
      },
    });
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain('Acme Crown Corporation');
    expect(serialized).not.toContain('free text concern');
  });

  it('returns the same shape for partial inputs (no field elision)', () => {
    const partial = classifyOrgContext({ rawForm: {} });
    const keys = Object.keys(partial).sort();
    expect(keys).toEqual(
      [
        'continuityComplexity',
        'continuityExposure',
        'doctrineVersion',
        'governanceComplexity',
        'institutionalScale',
        'isComplete',
        'rationale',
        'respondentLens',
        'usedConservativeDefault',
      ].sort(),
    );
  });
});
