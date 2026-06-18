import { describe, expect, it } from 'vitest';

import {
  checkAgainstRanking,
  checkAnonymisationIntegrity,
  checkKAnonymity,
  checkParticipation,
  checkReviewerReference,
  checkSectorCoherence,
  validateSectorBaseline,
  K_ANONYMITY_FLOOR,
} from '../intelligenceEthicsValidators';

describe('lib/intelligence/ethics/intelligenceEthicsValidators', () => {
  describe('checkKAnonymity', () => {
    it('refuses cohorts below the floor', () => {
      expect(checkKAnonymity(K_ANONYMITY_FLOOR - 1).readable).toBe(false);
      expect(checkKAnonymity(Number.NaN).readable).toBe(false);
    });
    it('accepts cohorts at or above the floor', () => {
      expect(checkKAnonymity(K_ANONYMITY_FLOOR).readable).toBe(true);
    });
  });

  describe('checkParticipation', () => {
    const grants = [
      { institutionRefHash: 'abc12345', grantedScopes: ['sector_baseline'] },
    ] as never[];

    it('refuses when no grant exists', () => {
      const v = checkParticipation(grants, 'missing', 'sector_baseline' as never);
      expect(v.reasons).toContain('institution_not_opted_in');
    });
    it('refuses when scope not granted', () => {
      const v = checkParticipation(grants, 'abc12345', 'other_scope' as never);
      expect(v.reasons).toContain('scope_not_granted');
    });
    it('accepts a granted scope', () => {
      expect(checkParticipation(grants, 'abc12345', 'sector_baseline' as never).readable).toBe(true);
    });
  });

  describe('checkAnonymisationIntegrity', () => {
    it('refuses extra keys', () => {
      const v = checkAnonymisationIntegrity({
        institutionRefHash: 'abcdefgh',
        sector: 'labour',
        contributedAt: 'now',
        name: 'leak',
      } as never);
      expect(v.reasons).toContain('institution_handle_exposed');
    });
    it('refuses short or missing hashes', () => {
      const v = checkAnonymisationIntegrity({
        institutionRefHash: 'short',
        sector: 'labour',
        contributedAt: 'now',
      } as never);
      expect(v.readable).toBe(false);
    });
    it('accepts a clean handle', () => {
      expect(
        checkAnonymisationIntegrity({
          institutionRefHash: 'abcdefgh',
          sector: 'labour',
          contributedAt: 'now',
        } as never).readable,
      ).toBe(true);
    });
  });

  describe('checkAgainstRanking', () => {
    it('passes non-objects', () => {
      expect(checkAgainstRanking(null).readable).toBe(true);
      expect(checkAgainstRanking('x').readable).toBe(true);
    });
    it('detects ranking fields', () => {
      expect(checkAgainstRanking({ leaderboard: [] }).reasons).toContain('ranking_payload_detected');
    });
    it('passes clean payloads', () => {
      expect(checkAgainstRanking({ readable: true }).readable).toBe(true);
    });
  });

  describe('checkReviewerReference', () => {
    it('refuses missing/empty references', () => {
      expect(checkReviewerReference(undefined).readable).toBe(false);
      expect(checkReviewerReference('  ').readable).toBe(false);
    });
    it('accepts a present reference', () => {
      expect(checkReviewerReference('rev-1').readable).toBe(true);
    });
  });

  describe('checkSectorCoherence', () => {
    it('refuses mismatched sectors', () => {
      const v = checkSectorCoherence('labour' as never, ['labour', 'health'] as never[]);
      expect(v.reasons).toContain('sector_mismatch');
    });
    it('accepts coherent sectors', () => {
      expect(checkSectorCoherence('labour' as never, ['labour', 'labour'] as never[]).readable).toBe(true);
    });
  });

  describe('validateSectorBaseline', () => {
    it('passes unreadable envelopes through', () => {
      expect(validateSectorBaseline({ readable: false } as never).readable).toBe(true);
    });
    it('refuses readable envelopes below the floor', () => {
      const v = validateSectorBaseline({ readable: true, contributingInstitutions: 2 } as never);
      expect(v.reasons).toContain('cohort_below_k_anonymity_floor');
    });
    it('refuses readable envelopes carrying ranking content', () => {
      const v = validateSectorBaseline({
        readable: true,
        contributingInstitutions: 10,
        percentile: 90,
      } as never);
      expect(v.reasons).toContain('ranking_payload_detected');
    });
    it('accepts a clean readable envelope', () => {
      expect(
        validateSectorBaseline({ readable: true, contributingInstitutions: 10 } as never).readable,
      ).toBe(true);
    });
  });
});
