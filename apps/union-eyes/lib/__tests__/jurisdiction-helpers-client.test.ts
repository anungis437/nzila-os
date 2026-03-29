import { describe, it, expect } from 'vitest';
import {
  mapJurisdictionValue,
  getJurisdictionName,
  requiresBilingualSupport,
  getDeadlineUrgency,
} from '../jurisdiction-helpers-client';

describe('jurisdiction-helpers-client', () => {
  describe('mapJurisdictionValue', () => {
    it('maps province abbreviation to CA- format', () => {
      expect(mapJurisdictionValue('ON')).toBe('CA-ON');
      expect(mapJurisdictionValue('BC')).toBe('CA-BC');
      expect(mapJurisdictionValue('QC')).toBe('CA-QC');
    });

    it('passes through CA- prefixed values', () => {
      expect(mapJurisdictionValue('CA-AB')).toBe('CA-AB');
    });

    it('maps Federal variants', () => {
      expect(mapJurisdictionValue('FEDERAL')).toBe('CA-FED');
      expect(mapJurisdictionValue('FED')).toBe('CA-FED');
      expect(mapJurisdictionValue('CA-FED')).toBe('CA-FED');
    });

    it('defaults to CA-FED for empty/unknown', () => {
      expect(mapJurisdictionValue('')).toBe('CA-FED');
      expect(mapJurisdictionValue('UNKNOWN')).toBe('CA-FED');
    });
  });

  describe('getJurisdictionName', () => {
    it('returns display name', () => {
      expect(getJurisdictionName('CA-ON')).toBe('Ontario');
      expect(getJurisdictionName('CA-FED')).toBe('Federal');
      expect(getJurisdictionName('CA-QC')).toBe('Quebec');
    });
  });

  describe('requiresBilingualSupport', () => {
    it('returns true for federal, Quebec, New Brunswick', () => {
      expect(requiresBilingualSupport('CA-FED')).toBe(true);
      expect(requiresBilingualSupport('CA-QC')).toBe(true);
      expect(requiresBilingualSupport('CA-NB')).toBe(true);
    });

    it('returns false for other provinces', () => {
      expect(requiresBilingualSupport('CA-ON')).toBe(false);
      expect(requiresBilingualSupport('CA-AB')).toBe(false);
    });
  });

  describe('getDeadlineUrgency', () => {
    it('returns critical for overdue', () => {
      expect(getDeadlineUrgency(-1).level).toBe('critical');
      expect(getDeadlineUrgency(-1).label).toBe('Overdue');
    });

    it('returns critical for due today', () => {
      expect(getDeadlineUrgency(0).level).toBe('critical');
      expect(getDeadlineUrgency(0).label).toBe('Due Today');
    });

    it('returns high for <= 3 days', () => {
      expect(getDeadlineUrgency(2).level).toBe('high');
    });

    it('returns medium for <= 7 days', () => {
      expect(getDeadlineUrgency(5).level).toBe('medium');
    });

    it('returns low for > 7 days', () => {
      expect(getDeadlineUrgency(10).level).toBe('low');
      expect(getDeadlineUrgency(10).label).toBe('On Track');
    });
  });

  /* ── Batch 32: branch gap-fill ── */

  describe('mapJurisdictionValue edge cases', () => {
    it('falls back to CA-FED for unknown CA- prefix', () => {
      // CA-XX not in mapping → fallback to 'CA-FED'
      const result = mapJurisdictionValue('CA-XX');
      expect(result).toBe('CA-FED');
    });

    it('falls back to CA-FED for non-CA prefix not in mapping', () => {
      const result = mapJurisdictionValue('US-NY');
      expect(result).toBe('CA-FED');
    });
  });

  describe('getJurisdictionName edge cases', () => {
    it('returns Unknown for unmapped jurisdiction', () => {
      const result = getJurisdictionName('ZZ-NOWHERE');
      expect(result).toBe('Unknown');
    });
  });
});
