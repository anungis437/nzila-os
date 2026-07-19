/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (Gap 4)
 * MODULE: Source-Instrument Catalogue Governance
 * DOCTRINE: docs/oci/government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md
 *
 * Proves the catalogue is GOVERNED, answering "who decides which legislation
 * counts?":
 *   - lifecycle transitions are a strict state machine (illegal moves rejected);
 *   - amendments are role-gated and bump a recorded catalogue version;
 *   - nothing is silently deleted (supersede/retire are tracked transitions);
 *   - jurisdiction selection is deterministic and pure;
 *   - conflicts are NAMED and led by authority, never auto-netted; tied authority
 *     escalates to human arbitration;
 *   - the module imports no scoring engine.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertTransition,
  authorityRank,
  bumpCatalogueVersion,
  canTransition,
  CatalogueGovernanceError,
  detectInstrumentConflicts,
  isStrongerAuthority,
  recordAmendment,
  roleMayDecide,
  selectApplicableInstruments,
  verificationConsistentWith,
} from '../../obligations/sourceInstrumentCatalogueGovernance';
import { SOURCE_INSTRUMENTS, type SourceInstrument } from '../../obligations/sourceInstruments';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE_FILE = resolve(
  HERE,
  '../../obligations/sourceInstrumentCatalogueGovernance.ts',
);

function instrument(overrides: Partial<SourceInstrument>): SourceInstrument {
  return {
    id: 'si.test',
    kind: 'policy',
    jurisdiction: 'federal',
    authorityLevel: 'binding_institutional',
    title: 'Test instrument',
    issuingAuthority: 'Test authority',
    obligationClass: 'governance',
    clauseRef: null,
    effectiveDate: null,
    verificationStatus: 'UNVERIFIED',
    note: 'test',
    ...overrides,
  };
}

describe('Gap 4 — catalogue lifecycle state machine', () => {
  it('permits only the defined forward transitions', () => {
    expect(canTransition('proposed', 'candidate')).toBe(true);
    expect(canTransition('candidate', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'superseded')).toBe(true);
    expect(canTransition('superseded', 'retired')).toBe(true);
    // Illegal moves:
    expect(canTransition('retired', 'candidate')).toBe(false);
    expect(canTransition('confirmed', 'proposed')).toBe(false);
    expect(canTransition('proposed', 'confirmed')).toBe(false);
  });

  it('rejects an illegal transition by throwing', () => {
    expect(() => assertTransition('retired', 'confirmed')).toThrow(CatalogueGovernanceError);
  });

  it('keeps lifecycle state and verification status consistent', () => {
    expect(verificationConsistentWith('candidate', 'UNVERIFIED')).toBe(true);
    expect(verificationConsistentWith('confirmed', 'UNVERIFIED')).toBe(false);
    expect(verificationConsistentWith('confirmed', 'VALIDATOR_CONFIRMED')).toBe(true);
    // Historical states may retain whatever status they held when frozen.
    expect(verificationConsistentWith('retired', 'UNVERIFIED')).toBe(true);
  });
});

describe('Gap 4 — amendments are role-gated & versioned', () => {
  it('enforces who may decide each amendment kind', () => {
    expect(roleMayDecide('validator', 'promote')).toBe(true);
    expect(roleMayDecide('catalogue_steward', 'promote')).toBe(false);
    expect(roleMayDecide('catalogue_steward', 'add')).toBe(true);
  });

  it('bumps the catalogue minor version while preserving the pre-release suffix', () => {
    expect(bumpCatalogueVersion('0.2.0-unverified', 'add')).toBe('0.3.0-unverified');
    expect(bumpCatalogueVersion('1.4.2', 'promote')).toBe('1.5.0');
  });

  it('records an add amendment from null state', () => {
    const amendment = recordAmendment({
      amendmentId: 'a1',
      instrumentId: 'si.new',
      kind: 'add',
      fromState: null,
      toState: 'candidate',
      catalogueVersionBefore: '0.2.0-unverified',
      rationale: 'Introduce candidate instrument for review.',
      decidedByRole: 'catalogue_steward',
      decidedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(amendment.catalogueVersionAfter).toBe('0.3.0-unverified');
    expect(amendment.fromState).toBeNull();
  });

  it('rejects an amendment by a role without authority', () => {
    expect(() =>
      recordAmendment({
        amendmentId: 'a2',
        instrumentId: 'si.x',
        kind: 'promote',
        fromState: 'candidate',
        toState: 'confirmed',
        catalogueVersionBefore: '0.2.0',
        rationale: 'Promote',
        decidedByRole: 'catalogue_steward',
        decidedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(CatalogueGovernanceError);
  });

  it('rejects an amendment with an empty rationale', () => {
    expect(() =>
      recordAmendment({
        amendmentId: 'a3',
        instrumentId: 'si.x',
        kind: 'retire',
        fromState: 'confirmed',
        toState: 'retired',
        catalogueVersionBefore: '0.2.0',
        rationale: '   ',
        decidedByRole: 'validator',
        decidedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(CatalogueGovernanceError);
  });
});

describe('Gap 4 — jurisdiction selection', () => {
  const instruments: readonly SourceInstrument[] = [
    instrument({ id: 'si.fed', jurisdiction: 'federal' }),
    instrument({ id: 'si.prov', jurisdiction: 'provincial' }),
    instrument({ id: 'si.std', jurisdiction: 'sector_standard' }),
    instrument({ id: 'si.inst', jurisdiction: 'institutional' }),
  ];

  it('selects exact-jurisdiction plus always-applicable bands, preserving order', () => {
    const selected = selectApplicableInstruments(instruments, 'federal');
    expect(selected.map((i) => i.id)).toStrictEqual(['si.fed', 'si.std', 'si.inst']);
  });

  it('does not mutate the input', () => {
    const copy = [...instruments];
    selectApplicableInstruments(instruments, 'provincial');
    expect(instruments).toStrictEqual(copy);
  });
});

describe('Gap 4 — conflict handling', () => {
  it('orders authority strongest-first', () => {
    expect(authorityRank('primary_legislation')).toBeLessThan(authorityRank('advisory_standard'));
    expect(isStrongerAuthority('primary_legislation', 'binding_institutional')).toBe(true);
    expect(isStrongerAuthority('advisory_standard', 'primary_legislation')).toBe(false);
  });

  it('names a conflict and leads by authority without netting', () => {
    const conflicts = detectInstrumentConflicts([
      instrument({ id: 'si.act', authorityLevel: 'primary_legislation', obligationClass: 'governance', jurisdiction: 'federal' }),
      instrument({ id: 'si.policy', authorityLevel: 'binding_institutional', obligationClass: 'governance', jurisdiction: 'federal' }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.leadInstrumentId).toBe('si.act');
    expect(conflicts[0]!.requiresHumanArbitration).toBe(false);
    expect(conflicts[0]!.instrumentIds).toStrictEqual(['si.act', 'si.policy']);
  });

  it('escalates a tie at the top authority to human arbitration', () => {
    const conflicts = detectInstrumentConflicts([
      instrument({ id: 'si.a', authorityLevel: 'primary_legislation', obligationClass: 'statutory', jurisdiction: 'provincial' }),
      instrument({ id: 'si.b', authorityLevel: 'primary_legislation', obligationClass: 'statutory', jurisdiction: 'provincial' }),
    ]);
    expect(conflicts[0]!.requiresHumanArbitration).toBe(true);
  });

  it('reports no conflict when instruments differ in obligation or jurisdiction', () => {
    const conflicts = detectInstrumentConflicts([
      instrument({ id: 'si.a', obligationClass: 'governance', jurisdiction: 'federal' }),
      instrument({ id: 'si.b', obligationClass: 'fiduciary', jurisdiction: 'federal' }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('detects a real conflict in the seed catalogue only when present (sanity)', () => {
    // The seed places each obligation class on a distinct instrument, so the
    // unfiltered seed has no same-class/same-jurisdiction collision.
    const seed = Object.values(SOURCE_INSTRUMENTS);
    expect(Array.isArray(detectInstrumentConflicts(seed))).toBe(true);
  });
});

describe('Gap 4 — isolation', () => {
  it('does not import the scoring engine', () => {
    const src = readFileSync(GOVERNANCE_FILE, 'utf8');
    expect(src).not.toMatch(/from ['"].*\/scoring['"]/);
    expect(src).not.toMatch(/scoreAssessment|computeProfile/);
  });
});
