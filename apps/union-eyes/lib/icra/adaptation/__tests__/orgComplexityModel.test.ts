import { describe, expect, it } from 'vitest';

import {
  complexityAtLeast,
  complexityAtMost,
  complexityRank,
  resolveContinuityComplexity,
  resolveContinuityExposure,
  resolveGovernanceComplexity,
  resolveInstitutionalScale,
} from '../orgComplexityModel';

describe('lib/icra/adaptation/orgComplexityModel', () => {
  describe('resolveInstitutionalScale', () => {
    it('returns undefined without a workforce band', () => {
      expect(resolveInstitutionalScale(undefined, false)).toBeUndefined();
    });

    it('maps workforce bands to scale', () => {
      expect(resolveInstitutionalScale('under_50', false)).toBe('micro');
      expect(resolveInstitutionalScale('5000_plus', false)).toBe('enterprise');
    });

    it('promotes mid_sized+ federations to federated_complex', () => {
      expect(resolveInstitutionalScale('250_999', true)).toBe('federated_complex');
      expect(resolveInstitutionalScale('under_50', true)).toBe('micro');
    });
  });

  describe('resolveContinuityComplexity', () => {
    it('returns undefined without a scale', () => {
      expect(resolveContinuityComplexity(undefined, 'under_5_years')).toBeUndefined();
    });

    it('maps large/federated scales directly', () => {
      expect(resolveContinuityComplexity('federated_complex', undefined)).toBe('organizational');
      expect(resolveContinuityComplexity('enterprise', undefined)).toBe('high');
      expect(resolveContinuityComplexity('mid_sized', undefined)).toBe('elevated');
    });

    it('splits micro by age band', () => {
      expect(resolveContinuityComplexity('micro', 'under_5_years')).toBe('low');
      expect(resolveContinuityComplexity('micro', '5_to_14_years')).toBe('moderate');
      expect(resolveContinuityComplexity('micro', '30_plus_years')).toBe('elevated');
      expect(resolveContinuityComplexity('micro', undefined)).toBe('low');
    });

    it('splits small by age band', () => {
      expect(resolveContinuityComplexity('small', 'under_5_years')).toBe('low');
      expect(resolveContinuityComplexity('small', '15_to_29_years')).toBe('moderate');
      expect(resolveContinuityComplexity('small', '30_plus_years')).toBe('elevated');
      expect(resolveContinuityComplexity('small', undefined)).toBe('moderate');
    });
  });

  describe('resolveGovernanceComplexity', () => {
    it('federation affiliation dominates', () => {
      expect(resolveGovernanceComplexity('elected_board', 'micro', true)).toBe('federated');
    });

    it('maps board governance models', () => {
      expect(resolveGovernanceComplexity('appointed_board', 'micro', false)).toBe('public_accountability');
      expect(resolveGovernanceComplexity('elected_board', 'large', false)).toBe('multi_layer');
      expect(resolveGovernanceComplexity('elected_board', 'micro', false)).toBe('structured');
      expect(resolveGovernanceComplexity('hybrid', 'micro', false)).toBe('multi_layer');
      expect(resolveGovernanceComplexity('other', 'micro', false)).toBe('simple');
      expect(resolveGovernanceComplexity(undefined, 'micro', false)).toBeUndefined();
    });
  });

  describe('resolveContinuityExposure', () => {
    it('handles missing sector with federated fallback', () => {
      expect(resolveContinuityExposure(undefined, 'federated_complex')).toBe('multi_site');
      expect(resolveContinuityExposure(undefined, 'micro')).toBeUndefined();
    });

    it('classifies known sectors', () => {
      expect(resolveContinuityExposure('healthcare', 'micro')).toBe('mission_critical');
      expect(resolveContinuityExposure('education', 'micro')).toBe('public_trust');
      expect(resolveContinuityExposure('labour_union', 'micro')).toBe('cross_functional');
      expect(resolveContinuityExposure('manufacturing', 'enterprise')).toBe('multi_site');
      expect(resolveContinuityExposure('manufacturing', 'micro')).toBe('localized');
    });
  });

  describe('complexity ordering', () => {
    it('ranks and compares', () => {
      expect(complexityRank('low')).toBe(0);
      expect(complexityRank('organizational')).toBe(4);
      expect(complexityAtLeast('high', 'moderate')).toBe(true);
      expect(complexityAtLeast('low', 'high')).toBe(false);
      expect(complexityAtMost('low', 'high')).toBe(true);
      expect(complexityAtMost('organizational', 'moderate')).toBe(false);
    });
  });
});
