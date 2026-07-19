import { describe, expect, it } from 'vitest';

import {
  localizeLikertScaleLabel,
  localizeMaturityLabel,
  localizeOptionGroup,
  localizeOptionLabel,
  localizeQuestion,
  localizeSection,
} from '../questions.i18n';

describe('lib/icra/questions.i18n', () => {
  describe('localizeSection', () => {
    it('returns fallback for en-CA', () => {
      const fb = { title: 'X', intro: 'Y' };
      expect(localizeSection('operational_dependency', fb, 'en-CA')).toBe(fb);
    });
    it('returns French translation for fr-CA', () => {
      const fb = { title: 'X', intro: 'Y' };
      const r = localizeSection('operational_dependency', fb, 'fr-CA');
      expect(r.title).toContain('Dépendance');
    });
  });

  describe('localizeMaturityLabel', () => {
    it('falls back for en-CA and translates for fr-CA', () => {
      expect(localizeMaturityLabel('0', 'None', 'en-CA')).toBe('None');
      expect(localizeMaturityLabel('0', 'None', 'fr-CA')).toBe('Inexistant');
      expect(localizeMaturityLabel('99', 'Unknown', 'fr-CA')).toBe('Unknown');
    });
  });

  describe('localizeLikertScaleLabel', () => {
    it('translates min/max bounds for fr-CA', () => {
      expect(localizeLikertScaleLabel('minLabel', 'fb', 'en-CA')).toBe('fb');
      expect(localizeLikertScaleLabel('minLabel', 'fb', 'fr-CA')).toContain('Pas du tout');
    });
  });

  describe('localizeQuestion', () => {
    it('returns identity view for en-CA', () => {
      const v = localizeQuestion({ id: 'od_01', prompt: 'P', helpText: 'H' }, 'en-CA');
      expect(v.prompt).toBe('P');
      expect(v.optionLabel('x', 'fb')).toBe('fb');
      expect(v.optionGroup('x', 'fb')).toBe('fb');
    });
    it('returns French translation and option lookups for fr-CA', () => {
      const v = localizeQuestion({ id: 'ctx_org_type', prompt: 'P' }, 'fr-CA');
      expect(v.prompt).toContain("type d'organisation");
      expect(v.optionLabel('local_union', 'fb')).toBe('Syndicat local');
      expect(v.optionGroup('local_union', undefined)).toContain('Travail');
      expect(v.optionLabel('missing', 'fb')).toBe('fb');
    });
    it('falls back to question prompt for unknown id in fr-CA', () => {
      const v = localizeQuestion({ id: 'no_such_id', prompt: 'Orig' }, 'fr-CA');
      expect(v.prompt).toBe('Orig');
    });
  });

  describe('localizeOptionLabel / localizeOptionGroup', () => {
    it('en-CA returns fallback', () => {
      expect(localizeOptionLabel('ctx_org_type', 'local_union', 'fb', 'en-CA')).toBe('fb');
      expect(localizeOptionGroup('ctx_org_type', 'local_union', 'fb', 'en-CA')).toBe('fb');
    });
    it('fr-CA returns translation or fallback', () => {
      expect(localizeOptionLabel('ctx_org_type', 'local_union', 'fb', 'fr-CA')).toBe('Syndicat local');
      expect(localizeOptionLabel('ctx_org_type', 'missing', 'fb', 'fr-CA')).toBe('fb');
      // ctx_sector options have no group → falls back to provided fallback
      expect(localizeOptionGroup('ctx_sector', 'public_sector', 'fb', 'fr-CA')).toBe('fb');
      expect(localizeOptionGroup('ctx_org_type', 'local_union', undefined, 'fr-CA')).toContain('Travail');
    });
  });
});
