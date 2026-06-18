/**
 * ARTIFACT TYPE: Vitest Suite — HubSpot Adaptive Property Privacy
 * MODULE: OCRA → CRM mapping anti-surveillance regression
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pins the exact property keys that may be derived from OCRA adaptive
 * context and shipped to HubSpot. This test MUST FAIL if anyone adds:
 *
 *   - Free-text fields (org name, primary challenge, notes)
 *   - Per-question identifiers (included/deferred IDs)
 *   - High-cardinality fingerprints (selectionFingerprint)
 *   - Email, name, or any individual respondent data
 */

import { describe, expect, it } from 'vitest';

import {
  classifyOrgContext,
  routeQuestionBank,
  type RoutableQuestion,
} from '@/lib/icra/adaptation';
import { ALL_QUESTIONS } from '@/lib/icra/questions';

import {
  OCRA_ADAPTIVE_CONTACT_PROPERTIES,
  OCRA_ADAPTIVE_PROPERTY_KEYS_ALLOWLIST,
  deriveOcraAdaptiveContactProperties,
} from '../icraAdaptiveProperties';

const SMALL_LOCAL_UNION = {
  ctx_org_type: 'local_union',
  ctx_sector: 'public_sector',
  ctx_membership_size: 'under_100',
};

describe('OCRA → HubSpot adaptive property mapping', () => {
  const profile = classifyOrgContext({ rawForm: SMALL_LOCAL_UNION });
  const bank = routeQuestionBank(
    ALL_QUESTIONS as any as RoutableQuestion[],
    profile,
  );

  it('only emits keys from the allowlist', () => {
    const props = deriveOcraAdaptiveContactProperties(profile, bank);
    const keys = Object.keys(props);
    for (const k of keys) {
      expect(OCRA_ADAPTIVE_PROPERTY_KEYS_ALLOWLIST).toContain(k);
    }
  });

  it('emits exactly the documented 9 properties — no more, no less', () => {
    const props = deriveOcraAdaptiveContactProperties(profile, bank);
    expect(Object.keys(props).sort()).toEqual(
      [...OCRA_ADAPTIVE_PROPERTY_KEYS_ALLOWLIST].sort(),
    );
  });

  it('never includes forbidden PII / high-cardinality keys', () => {
    const props = deriveOcraAdaptiveContactProperties(profile, bank);
    const forbidden = [
      'email',
      'name',
      'orgName',
      'organization_name',
      'phone',
      'primary_challenge',
      'free_text',
      'selection_fingerprint',
      'ocra_selection_fingerprint',
      'included_question_ids',
      'deferred_question_ids',
      'routing_rationale',
      'org_context_raw',
    ];
    for (const k of forbidden) {
      expect(k in props).toBe(false);
    }
  });

  it('values are all enums, small integers, or booleans (no objects, arrays, free text)', () => {
    const props = deriveOcraAdaptiveContactProperties(profile, bank);
    for (const [k, v] of Object.entries(props)) {
      expect(['string', 'number', 'boolean']).toContain(typeof v);
      if (typeof v === 'string') {
        // Low-cardinality enum strings only — no PII, no whitespace-heavy text
        expect(v.length).toBeLessThanOrEqual(40);
        expect(v).not.toMatch(/[@]/);
      }
      if (typeof v === 'number') {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(v)).toBe(true);
      }
      // Test variable used to silence "unused" lints
      expect(k.length).toBeGreaterThan(0);
    }
  });

  it('institutionalScale value matches the profile band exactly', () => {
    const props = deriveOcraAdaptiveContactProperties(profile, bank);
    expect(
      props[OCRA_ADAPTIVE_CONTACT_PROPERTIES.institutionalScale],
    ).toBe(profile.institutionalScale);
  });

  it('routedQuestionCount + deferredQuestionCount equals the total bank size', () => {
    const props = deriveOcraAdaptiveContactProperties(profile, bank);
    const total =
      Number(props[OCRA_ADAPTIVE_CONTACT_PROPERTIES.routedQuestionCount] ?? 0) +
      Number(
        props[OCRA_ADAPTIVE_CONTACT_PROPERTIES.deferredQuestionCount] ?? 0,
      );
    expect(total).toBe(
      bank.includedQuestions.length + bank.deferredQuestions.length,
    );
  });

  it('is deterministic across calls', () => {
    const a = deriveOcraAdaptiveContactProperties(profile, bank);
    const b = deriveOcraAdaptiveContactProperties(profile, bank);
    expect(a).toEqual(b);
  });
});
