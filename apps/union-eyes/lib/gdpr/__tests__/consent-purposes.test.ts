import { describe, it, expect } from 'vitest';
import {
  consentTypeValues,
  consentPurposes,
  type ConsentType,
  type ConsentPurposeConfig,
} from '../consent-purposes';

describe('consentTypeValues', () => {
  it('contains expected consent types', () => {
    expect(consentTypeValues).toContain('essential');
    expect(consentTypeValues).toContain('functional');
    expect(consentTypeValues).toContain('analytics');
    expect(consentTypeValues).toContain('marketing');
    expect(consentTypeValues).toContain('personalization');
    expect(consentTypeValues).toContain('third_party');
  });

  it('has 6 values', () => {
    expect(consentTypeValues).toHaveLength(6);
  });
});

describe('consentPurposes', () => {
  it('is a non-empty array', () => {
    expect(consentPurposes.length).toBeGreaterThan(0);
  });

  it('all entries have required fields', () => {
    for (const purpose of consentPurposes) {
      expect(purpose.id).toBeTruthy();
      expect(purpose.name).toBeTruthy();
      expect(purpose.description).toBeTruthy();
      expect(typeof purpose.required).toBe('boolean');
      expect(purpose.legalBasis).toBeTruthy();
      expect(purpose.processingPurpose).toBeTruthy();
      expect(Array.isArray(purpose.dataUse)).toBe(true);
      expect(purpose.dataUse.length).toBeGreaterThan(0);
      expect(purpose.retentionPeriod).toBeTruthy();
      expect(purpose.consentText).toBeTruthy();
      expect(purpose.consentVersion).toBeTruthy();
    }
  });

  it('essential consent is marked as required', () => {
    const essential = consentPurposes.find((p) => p.id === 'essential');
    expect(essential).toBeDefined();
    expect(essential!.required).toBe(true);
  });

  it('non-essential consents are not required', () => {
    const nonEssential = consentPurposes.filter((p) => p.id !== 'essential');
    for (const p of nonEssential) {
      expect(p.required).toBe(false);
    }
  });

  it('all IDs are unique', () => {
    const ids = consentPurposes.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all IDs are valid ConsentType values', () => {
    for (const purpose of consentPurposes) {
      expect(consentTypeValues).toContain(purpose.id);
    }
  });

  it('category values are valid', () => {
    const validCategories = ['essential', 'functional', 'analytics', 'marketing'];
    for (const purpose of consentPurposes) {
      expect(validCategories).toContain(purpose.category);
    }
  });

  it('essential has contract_performance legal basis', () => {
    const essential = consentPurposes.find((p) => p.id === 'essential');
    expect(essential!.legalBasis).toBe('contract_performance');
  });

  it('type ConsentType is assignable from consentTypeValues', () => {
    const val: ConsentType = consentTypeValues[0];
    expect(val).toBe('essential');
  });

  it('ConsentPurposeConfig matches shape', () => {
    const cfg: ConsentPurposeConfig = consentPurposes[0];
    expect(cfg.id).toBeTruthy();
    expect(cfg.name).toBeTruthy();
  });
});
