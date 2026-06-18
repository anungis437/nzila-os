/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (Gap 1 extension)
 * MODULE: Source Instrument — AuthorityLevel + EffectiveDate reference fields
 * DOCTRINE: docs/oci/government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md
 *
 * Proves the reference-only authority/effective-date fields:
 *   - every seed instrument carries an AuthorityLevel consistent with its kind;
 *   - effectiveDate is NEVER fabricated (null across the UNVERIFIED seed);
 *   - authorityLevel + effectiveDate propagate into a built Citation;
 *   - these fields are reference data only (module imports no scoring engine).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  authorityLevelForKind,
  buildCitation,
  SOURCE_INSTRUMENTS,
  SOURCE_INSTRUMENT_IDS,
  type AuthorityLevel,
} from '../../obligations/sourceInstruments';

const HERE = dirname(fileURLToPath(import.meta.url));
const OBLIGATIONS_DIR = resolve(HERE, '../../obligations');

const ALL_AUTHORITY_LEVELS: ReadonlySet<AuthorityLevel> = new Set([
  'primary_legislation',
  'subordinate_legislation',
  'binding_executive_policy',
  'binding_institutional',
  'advisory_standard',
]);

describe('Gap 1 — source instrument authority & effective date', () => {
  it('every seed instrument has an authority level consistent with its kind', () => {
    for (const id of SOURCE_INSTRUMENT_IDS) {
      const instrument = SOURCE_INSTRUMENTS[id];
      expect(ALL_AUTHORITY_LEVELS.has(instrument.authorityLevel)).toBe(true);
      expect(instrument.authorityLevel).toBe(authorityLevelForKind(instrument.kind));
    }
  });

  it('never fabricates an effective date in the UNVERIFIED seed', () => {
    for (const id of SOURCE_INSTRUMENT_IDS) {
      expect(SOURCE_INSTRUMENTS[id].effectiveDate).toBeNull();
    }
  });

  it('maps each kind to the right legal-force band', () => {
    expect(authorityLevelForKind('statute')).toBe('primary_legislation');
    expect(authorityLevelForKind('regulation')).toBe('subordinate_legislation');
    expect(authorityLevelForKind('treasury_board_instrument')).toBe('binding_executive_policy');
    expect(authorityLevelForKind('directive')).toBe('binding_executive_policy');
    expect(authorityLevelForKind('mandate')).toBe('binding_executive_policy');
    expect(authorityLevelForKind('policy')).toBe('binding_institutional');
    expect(authorityLevelForKind('bylaw')).toBe('binding_institutional');
    expect(authorityLevelForKind('standard')).toBe('advisory_standard');
  });

  it('propagates authorityLevel and effectiveDate into a built citation', () => {
    const instrument = SOURCE_INSTRUMENTS['si.enabling_statute'];
    const citation = buildCitation(instrument, 'VERIFIED');
    expect(citation.authorityLevel).toBe(instrument.authorityLevel);
    expect(citation.effectiveDate).toBe(instrument.effectiveDate);
    // UNVERIFIED seed → never defensible regardless of evidence.
    expect(citation.defensible).toBe(false);
  });

  it('remains reference-only: no scoring import', () => {
    const src = readFileSync(resolve(OBLIGATIONS_DIR, 'sourceInstruments.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"]\.\.\/scoring['"]/);
    expect(src).not.toMatch(/scoreAssessment|computeProfile/);
  });
});
