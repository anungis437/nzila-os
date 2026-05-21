/**
 * OCI sector baseline invariants.
 */

import { describe, expect, it } from 'vitest';

import { SECTOR_BASELINES, SECTOR_BASELINES_BY_ID } from '../sectorBaselines';
import { STEWARDSHIP_BURDEN_PATTERNS_BY_ID } from '../stewardshipBurdenPatterns';
import type { InstitutionalSectorId } from '../types';

const REQUIRED_SECTORS: readonly InstitutionalSectorId[] = [
  'union-cba-administration',
  'union-pension-administration',
  'healthcare-clinical-governance',
  'healthcare-administrative-governance',
  'municipal-government',
  'regional-government',
  'federal-program-administration',
  'post-secondary-academic-governance',
  'post-secondary-administrative-governance',
  'non-profit-federation',
  'cooperative-governance',
  'regulated-professional-college',
];

const FORBIDDEN_TERMS: readonly string[] = [
  'transformation',
  'optimize',
  'optimise',
  'productivity',
  'autonomous',
  'disrupt',
  'automation',
  'automate',
  'ai-led',
  'ai-driven',
  'ai-powered',
  'all-in-one',
  'frictionless',
  'seamless',
  'behavioural analytics',
  'behavioral analytics',
  'scoring',
];

describe('SECTOR_BASELINES', () => {
  it('covers every required sector exactly once', () => {
    const seen = SECTOR_BASELINES.map((b) => b.sectorId).sort();
    expect(seen).toEqual([...REQUIRED_SECTORS].sort());
  });

  it('exposes a lookup keyed by sectorId', () => {
    for (const baseline of SECTOR_BASELINES) {
      expect(SECTOR_BASELINES_BY_ID[baseline.sectorId]).toBe(baseline);
    }
  });

  it('declares ordered ranges (low <= median <= high) for every measure', () => {
    for (const b of SECTOR_BASELINES) {
      for (const range of [
        b.typicalStewardshipDensityRange,
        b.typicalContinuityFragilityRange,
      ]) {
        expect(range.low).toBeLessThanOrEqual(range.median);
        expect(range.median).toBeLessThanOrEqual(range.high);
      }
    }
  });

  it('references only known burden pattern ids', () => {
    for (const b of SECTOR_BASELINES) {
      for (const patternId of b.commonBurdenPatternIds) {
        expect(
          STEWARDSHIP_BURDEN_PATTERNS_BY_ID[patternId],
          `Sector ${b.sectorId} references unknown pattern ${patternId}`,
        ).toBeDefined();
      }
    }
  });

  it('uses no forbidden marketing vocabulary in descriptive fields', () => {
    for (const b of SECTOR_BASELINES) {
      const blob = [
        b.displayName['en-CA'],
        b.description['en-CA'],
        b.facilitationPostureNotes['en-CA'],
      ]
        .join('\n')
        .toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(
          blob.includes(term),
          `Sector ${b.sectorId} contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });
});
