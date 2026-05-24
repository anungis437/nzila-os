import { describe, expect, it } from 'vitest';
import {
  computeStewardshipDensity,
  classifyDensity,
  DENSITY_BANDS,
  type HolderForIndex,
} from '../stewardship-density-index';

describe('Stewardship Density Index', () => {
  describe('computeStewardshipDensity', () => {
    it('returns empty result (band=distributed, index=0) for no holders', () => {
      const result = computeStewardshipDensity([]);
      expect(result.index).toBe(0);
      expect(result.band.id).toBe('distributed');
      expect(result.totalCarriers).toBe(0);
      expect(result.totalWeight).toBe(0);
      expect(result.exposedWeight).toBe(0);
    });

    it('skips holders with null criticality (do not contribute to weight)', () => {
      const holders: HolderForIndex[] = [
        { criticality: null, tenureBand: '7_15y', successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      expect(result.totalCarriers).toBe(1);
      expect(result.totalWeight).toBe(0);
      expect(result.exposedWeight).toBe(0);
      expect(result.index).toBe(0);
    });

    it('classifies as critical when all institution_critical carriers lack successors', () => {
      const holders: HolderForIndex[] = [
        { criticality: 'institution_critical', tenureBand: '7_15y', successorIdentified: false },
        { criticality: 'institution_critical', tenureBand: '15y_plus', successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      expect(result.index).toBe(1);
      expect(result.band.id).toBe('critical');
      expect(result.institutionCriticalCount).toBe(2);
      expect(result.unsuccessedInstitutionCriticalCount).toBe(2);
    });

    it('classifies as distributed when all carriers have identified successors', () => {
      const holders: HolderForIndex[] = [
        { criticality: 'institution_critical', tenureBand: '15y_plus', successorIdentified: true },
        { criticality: 'load_bearing', tenureBand: '7_15y', successorIdentified: true },
      ];
      const result = computeStewardshipDensity(holders);
      expect(result.index).toBe(0);
      expect(result.band.id).toBe('distributed');
      expect(result.exposedWeight).toBe(0);
    });

    it('counts load_bearing and institution_critical separately', () => {
      const holders: HolderForIndex[] = [
        { criticality: 'load_bearing', tenureBand: '3_7y', successorIdentified: false },
        { criticality: 'load_bearing', tenureBand: '7_15y', successorIdentified: true },
        { criticality: 'institution_critical', tenureBand: '15y_plus', successorIdentified: false },
        { criticality: 'routine', tenureBand: '0_3y', successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      expect(result.loadBearingCount).toBe(2);
      expect(result.unsuccessedLoadBearingCount).toBe(1);
      expect(result.institutionCriticalCount).toBe(1);
      expect(result.unsuccessedInstitutionCriticalCount).toBe(1);
    });

    it('uses tenure 1.0 when tenureBand is null', () => {
      const holders: HolderForIndex[] = [
        { criticality: 'institution_critical', tenureBand: null, successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      // criticality=1.0, tenure=1.0 => weight 1, fully exposed
      expect(result.totalWeight).toBe(1);
      expect(result.exposedWeight).toBe(1);
      expect(result.index).toBe(1);
    });

    it('applies tenure amplifier of 1.15 for 15y_plus carriers', () => {
      const holders: HolderForIndex[] = [
        { criticality: 'routine', tenureBand: '15y_plus', successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      // 0.25 * 1.15 = 0.2875 -> round2 = 0.29
      expect(result.totalWeight).toBe(0.29);
      expect(result.exposedWeight).toBe(0.29);
    });

    it('produces a fractional index when only some carriers are exposed', () => {
      const holders: HolderForIndex[] = [
        { criticality: 'load_bearing', tenureBand: '7_15y', successorIdentified: false }, // 0.85 exposed
        { criticality: 'load_bearing', tenureBand: '7_15y', successorIdentified: true },  // 0.85 covered
      ];
      const result = computeStewardshipDensity(holders);
      expect(result.index).toBe(0.5);
      expect(result.band.id).toBe('fragile');
    });
  });

  describe('classifyDensity', () => {
    it('returns critical for index >= 0.7', () => {
      expect(classifyDensity(0.7).id).toBe('critical');
      expect(classifyDensity(0.95).id).toBe('critical');
    });

    it('returns fragile for 0.5 <= index < 0.7', () => {
      expect(classifyDensity(0.5).id).toBe('fragile');
      expect(classifyDensity(0.69).id).toBe('fragile');
    });

    it('returns concentrated for 0.3 <= index < 0.5', () => {
      expect(classifyDensity(0.3).id).toBe('concentrated');
      expect(classifyDensity(0.49).id).toBe('concentrated');
    });

    it('returns observed for 0.15 <= index < 0.3', () => {
      expect(classifyDensity(0.15).id).toBe('observed');
      expect(classifyDensity(0.29).id).toBe('observed');
    });

    it('returns distributed for index < 0.15', () => {
      expect(classifyDensity(0).id).toBe('distributed');
      expect(classifyDensity(0.14).id).toBe('distributed');
    });

    it('exposes exactly five bands in descending order', () => {
      expect(DENSITY_BANDS).toHaveLength(5);
      for (let i = 0; i < DENSITY_BANDS.length - 1; i++) {
        expect(DENSITY_BANDS[i].lowerBound).toBeGreaterThan(DENSITY_BANDS[i + 1].lowerBound);
      }
    });

    it('tolerates NaN/Infinity inputs (coerces to 0 -> distributed; Infinity is never a valid measurement)', () => {
      expect(classifyDensity(Number.NaN).id).toBe('distributed');
      expect(classifyDensity(Number.POSITIVE_INFINITY).id).toBe('distributed');
      expect(classifyDensity(Number.NEGATIVE_INFINITY).id).toBe('distributed');
    });

    it('clamps out-of-range inputs to [0,1]', () => {
      expect(classifyDensity(-99).id).toBe('distributed');
      expect(classifyDensity(99).id).toBe('critical');
    });
  });

  describe('hardening', () => {
    it('DENSITY_BANDS is deeply frozen', () => {
      expect(Object.isFrozen(DENSITY_BANDS)).toBe(true);
      for (const band of DENSITY_BANDS) {
        expect(Object.isFrozen(band)).toBe(true);
      }
    });

    it('returns a fresh result object on every call (no shared mutable state)', () => {
      const a = computeStewardshipDensity([]);
      const b = computeStewardshipDensity([]);
      expect(a).not.toBe(b);
      // Caller mutation of `a` must not affect `b`
      a.totalCarriers = 99;
      expect(b.totalCarriers).toBe(0);
    });

    it('skips holders with unknown criticality (DB enum drift) without NaN leakage', () => {
      const holders = [
        { criticality: 'institution_critical' as const, tenureBand: '7_15y' as const, successorIdentified: false },
        // Simulate a DB row whose criticality column has a new/unrecognised value.
        { criticality: 'rogue_enum' as unknown as null, tenureBand: '7_15y' as const, successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      expect(Number.isFinite(result.index)).toBe(true);
      expect(result.index).toBe(1);
      // Both rows are counted as carriers; only the known-criticality row contributes weight.
      expect(result.totalCarriers).toBe(2);
    });

    it('skips holders with unknown tenureBand (uses 1.0 amplifier)', () => {
      const holders = [
        { criticality: 'institution_critical' as const, tenureBand: 'rogue' as unknown as null, successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      // criticality 1.0 * tenure fallback 1.0 = 1.0
      expect(result.totalWeight).toBe(1);
      expect(result.exposedWeight).toBe(1);
    });

    it('skips null/undefined holder rows defensively', () => {
      const holders = [
        null as unknown as HolderForIndex,
        undefined as unknown as HolderForIndex,
        { criticality: 'institution_critical' as const, tenureBand: '7_15y' as const, successorIdentified: false },
      ];
      const result = computeStewardshipDensity(holders);
      expect(result.totalCarriers).toBe(1);
      expect(result.index).toBe(1);
    });

    it('returns the empty result when input is not an array', () => {
      const result = computeStewardshipDensity(undefined as unknown as readonly HolderForIndex[]);
      expect(result.index).toBe(0);
      expect(result.band.id).toBe('distributed');
      expect(result.totalCarriers).toBe(0);
    });
  });
});
