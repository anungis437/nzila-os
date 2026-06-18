import { describe, expect, it } from 'vitest';

import {
  getProfileFieldValue,
  isExternalRespondent,
  isFederated,
  isLargeScale,
  isPublicAccountability,
  isSmallScale,
  profileBandSummary,
} from '../institutionalProfileLens';
import type { InstitutionalAssessmentProfile } from '../types';

function profile(overrides: Partial<InstitutionalAssessmentProfile> = {}): InstitutionalAssessmentProfile {
  return {
    doctrineVersion: 'v1' as never,
    institutionalScale: 'small',
    continuityComplexity: 'low' as never,
    governanceComplexity: 'simple' as never,
    continuityExposure: 'operational' as never,
    respondentLens: 'internal_staff' as never,
    declaredInputs: {} as never,
    rationale: [],
    isComplete: true,
    usedConservativeDefault: false,
    ...overrides,
  };
}

describe('lib/icra/adaptation/institutionalProfileLens', () => {
  describe('scale lenses', () => {
    it('classifies small and large scales', () => {
      expect(isSmallScale('micro')).toBe(true);
      expect(isSmallScale('small')).toBe(true);
      expect(isSmallScale('large')).toBe(false);
      expect(isLargeScale('large')).toBe(true);
      expect(isLargeScale('enterprise')).toBe(true);
      expect(isLargeScale('federated_complex')).toBe(true);
      expect(isLargeScale('small')).toBe(false);
    });
  });

  describe('isFederated', () => {
    it('detects federation via scale or governance', () => {
      expect(isFederated(profile({ institutionalScale: 'federated_complex' }))).toBe(true);
      expect(isFederated(profile({ governanceComplexity: 'federated' as never }))).toBe(true);
      expect(isFederated(profile())).toBe(false);
    });
  });

  describe('isPublicAccountability', () => {
    it('detects public accountability across dimensions', () => {
      expect(isPublicAccountability(profile({ governanceComplexity: 'public_accountability' as never }))).toBe(true);
      expect(isPublicAccountability(profile({ continuityExposure: 'public_trust' as never }))).toBe(true);
      expect(isPublicAccountability(profile({ continuityExposure: 'mission_critical' as never }))).toBe(true);
      expect(isPublicAccountability(profile())).toBe(false);
    });
  });

  describe('isExternalRespondent', () => {
    it('detects external respondent lenses', () => {
      expect(isExternalRespondent('external_advisor')).toBe(true);
      expect(isExternalRespondent('legal_or_counsel')).toBe(true);
      expect(isExternalRespondent('internal_staff' as never)).toBe(false);
    });
  });

  describe('getProfileFieldValue', () => {
    it('returns each profile field', () => {
      const p = profile();
      expect(getProfileFieldValue(p, 'institutionalScale')).toBe('small');
      expect(getProfileFieldValue(p, 'continuityComplexity')).toBe('low');
      expect(getProfileFieldValue(p, 'governanceComplexity')).toBe('simple');
      expect(getProfileFieldValue(p, 'continuityExposure')).toBe('operational');
      expect(getProfileFieldValue(p, 'respondentLens')).toBe('internal_staff');
    });
  });

  describe('profileBandSummary', () => {
    it('joins band dimensions with a pipe', () => {
      expect(profileBandSummary(profile())).toBe('small|low|simple|operational|internal_staff');
    });
  });
});
