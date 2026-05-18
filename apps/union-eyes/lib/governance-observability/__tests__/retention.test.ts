import { describe, it, expect } from 'vitest';
import {
  mapCategoryToRetention,
  mapSensitivityToRetention,
  mostRestrictiveRetention,
  resolveRetentionClass,
  type RetentionClass,
} from '../retention';

describe('mapCategoryToRetention', () => {
  it('maps auth → standard', () => {
    expect(mapCategoryToRetention('auth')).toBe('standard');
  });

  it('maps governance → governance', () => {
    expect(mapCategoryToRetention('governance')).toBe('governance');
  });

  it('maps ai-operation → governance', () => {
    expect(mapCategoryToRetention('ai-operation')).toBe('governance');
  });

  it('maps publication → governance', () => {
    expect(mapCategoryToRetention('publication')).toBe('governance');
  });

  it('maps member-action → governance', () => {
    expect(mapCategoryToRetention('member-action')).toBe('governance');
  });

  it('maps export → governance', () => {
    expect(mapCategoryToRetention('export')).toBe('governance');
  });

  it('maps audit → governance', () => {
    expect(mapCategoryToRetention('audit')).toBe('governance');
  });

  it('maps federation → governance', () => {
    expect(mapCategoryToRetention('federation')).toBe('governance');
  });

  it('maps security → legal-hold', () => {
    expect(mapCategoryToRetention('security')).toBe('legal-hold');
  });
});

describe('mapSensitivityToRetention', () => {
  it('maps public → ephemeral', () => {
    expect(mapSensitivityToRetention('public')).toBe('ephemeral');
  });

  it('maps internal → standard', () => {
    expect(mapSensitivityToRetention('internal')).toBe('standard');
  });

  it('maps confidential → governance', () => {
    expect(mapSensitivityToRetention('confidential')).toBe('governance');
  });

  it('maps restricted → legal-hold', () => {
    expect(mapSensitivityToRetention('restricted')).toBe('legal-hold');
  });

  it('maps regulated → legal-hold', () => {
    expect(mapSensitivityToRetention('regulated')).toBe('legal-hold');
  });
});

describe('mostRestrictiveRetention', () => {
  const cases: [RetentionClass, RetentionClass, RetentionClass][] = [
    ['ephemeral', 'standard', 'standard'],
    ['standard', 'governance', 'governance'],
    ['governance', 'legal-hold', 'legal-hold'],
    ['legal-hold', 'permanent', 'permanent'],
    ['permanent', 'ephemeral', 'permanent'],
    ['governance', 'governance', 'governance'],
  ];

  it.each(cases)('mostRestrictive(%s, %s) === %s', (a, b, expected) => {
    expect(mostRestrictiveRetention(a, b)).toBe(expected);
  });
});

describe('resolveRetentionClass', () => {
  it('uses most restrictive of category and sensitivity', () => {
    // auth → standard; restricted → legal-hold; most restrictive is legal-hold
    expect(resolveRetentionClass('auth', 'restricted')).toBe('legal-hold');
  });

  it('security category always returns legal-hold regardless of sensitivity', () => {
    expect(resolveRetentionClass('security', 'public')).toBe('legal-hold');
  });

  it('governance category + internal sensitivity → governance (category wins)', () => {
    expect(resolveRetentionClass('governance', 'internal')).toBe('governance');
  });

  it('ai-operation + confidential → governance', () => {
    expect(resolveRetentionClass('ai-operation', 'confidential')).toBe('governance');
  });
});
