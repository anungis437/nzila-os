/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (Phase G / T6)
 * MODULE: Source Instrument Traceability
 * DOCTRINE: docs/oci/government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md
 *
 * Extends the chain Finding → Obligation → Source Instrument → Citation. Proves:
 *   - the seed catalogue is wholly UNVERIFIED and asserts no clause numbers;
 *   - a citation's assertion level is gated by evidence (statutes need VERIFIED);
 *   - nothing is `defensible` until a validator confirms the instrument;
 *   - mapping is scoring-isolated and deterministic;
 *   - the record's evidence-floor integrity invariant holds.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import { deriveFindings, type EvidenceInputs } from '../../findings/findingDerivation';
import { buildTraceabilityRecord } from '../../traceability/traceabilityRecord';
import {
  buildCitation,
  citationAssertionFor,
  SOURCE_INSTRUMENTS,
  SOURCE_INSTRUMENT_IDS,
} from '../../obligations/sourceInstruments';
import {
  mapObligationsToCitations,
} from '../../obligations/sourceInstrumentMapping';
import type { EvidenceLevel } from '../../evidence-strength/evidenceTaxonomy';

const HERE = dirname(fileURLToPath(import.meta.url));
const OBLIGATIONS_DIR = resolve(HERE, '../../obligations');

const ALL_EVIDENCE: readonly EvidenceLevel[] = [
  'NONE',
  'VERBAL',
  'DOCUMENTED',
  'OPERATIONAL',
  'VERIFIED',
  'CROSS_VALIDATED',
];

describe('Phase G — source instrument traceability', () => {
  it('the seed catalogue is wholly UNVERIFIED and asserts no clause numbers', () => {
    expect(SOURCE_INSTRUMENT_IDS.length).toBeGreaterThan(0);
    for (const id of SOURCE_INSTRUMENT_IDS) {
      const instrument = SOURCE_INSTRUMENTS[id];
      expect(instrument.verificationStatus).toBe('UNVERIFIED');
      // We never fabricate a clause/section reference in the seed.
      expect(instrument.clauseRef).toBeNull();
    }
  });

  it('source-instrument modules do not import the scoring engine', () => {
    for (const file of ['sourceInstruments.ts', 'sourceInstrumentMapping.ts']) {
      const src = readFileSync(resolve(OBLIGATIONS_DIR, file), 'utf8');
      expect(src).not.toMatch(/from ['"]\.\.\/scoring['"]/);
      expect(src).not.toMatch(/scoreAssessment|computeProfile/);
    }
  });

  it('a statute is never ASSERTED below VERIFIED evidence (VQ3 floor)', () => {
    const statute = SOURCE_INSTRUMENTS['si.enabling_statute'];
    expect(statute.kind).toBe('statute');
    for (const level of ['VERBAL', 'DOCUMENTED', 'OPERATIONAL'] as const) {
      expect(citationAssertionFor('statute', level)).not.toBe('asserted');
    }
    expect(citationAssertionFor('statute', 'VERIFIED')).toBe('asserted');
    expect(citationAssertionFor('statute', 'CROSS_VALIDATED')).toBe('asserted');
  });

  it('NONE evidence withholds every citation', () => {
    for (const id of SOURCE_INSTRUMENT_IDS) {
      const c = buildCitation(SOURCE_INSTRUMENTS[id], 'NONE');
      expect(c.assertion).toBe('withheld');
    }
  });

  it('no citation is defensible while the catalogue is UNVERIFIED', () => {
    for (const id of SOURCE_INSTRUMENT_IDS) {
      for (const level of ALL_EVIDENCE) {
        const c = buildCitation(SOURCE_INSTRUMENTS[id], level);
        expect(c.defensible).toBe(false);
      }
    }
  });

  it('policy/standard citations assert at DOCUMENTED, statutes do not', () => {
    const policy = mapObligationsToCitations(['policy'], 'DOCUMENTED');
    expect(policy.some((c) => c.assertion === 'asserted')).toBe(true);

    const statutory = mapObligationsToCitations(['statutory'], 'DOCUMENTED');
    // Statutory instrument is named but only `referenced` below VERIFIED.
    expect(statutory.every((c) => c.assertion !== 'asserted')).toBe(true);
    expect(statutory.some((c) => c.assertion === 'referenced')).toBe(true);
  });

  it('mapping is deterministic and tier-ordered (highest gravity first)', () => {
    const a = mapObligationsToCitations(['operational', 'statutory', 'governance'], 'VERIFIED');
    const b = mapObligationsToCitations(['operational', 'statutory', 'governance'], 'VERIFIED');
    expect(a).toStrictEqual(b);
    // statutory (tier 1) must precede governance (tier 4) must precede operational (tier 7).
    const order = a.map((c) => c.obligationClass);
    expect(order.indexOf('statutory')).toBeLessThan(order.indexOf('governance'));
    expect(order.indexOf('governance')).toBeLessThan(order.indexOf('operational'));
  });

  it('unknown / empty obligation classes yield no citations', () => {
    expect(mapObligationsToCitations([], 'CROSS_VALIDATED')).toStrictEqual([]);
  });

  it('traceability record carries citations and the evidence-floor invariant holds', () => {
    const evidence: EvidenceInputs = {
      evidenceByTheme: {
        undocumented_succession_authority: 'DOCUMENTED',
        board_oversight_gap: 'DOCUMENTED',
        no_continuity_plan: 'DOCUMENTED',
        records_retention_gap: 'OPERATIONAL',
        missing_delegation_instrument: 'DOCUMENTED',
        institutional_memory_concentration: 'OPERATIONAL',
      },
    };
    const { trace } = scoreAssessment('phase-g', buildUniformAnswers(0));
    const findings = deriveFindings(trace, evidence);
    const record = buildTraceabilityRecord('phase-g', trace, findings);

    expect(record.findingCitations.length).toBe(findings.length);
    expect(record.sourceInstrumentCatalogueVersion).toMatch(/unverified/);
    expect(record.chainIntegrity.everyAssertedCitationMeetsEvidenceFloor).toBe(true);
    expect(record.chainIntegrity.intact).toBe(true);

    // Every asserted citation in the record clears its kind's floor.
    for (const fc of record.findingCitations) {
      for (const c of fc.citations) {
        if (c.assertion === 'asserted') {
          // statutes/regulations would only assert at VERIFIED+, which this
          // DOCUMENTED/OPERATIONAL fixture never reaches.
          expect(['statute', 'regulation']).not.toContain(c.kind);
        }
      }
    }
  });

  it('record with citations remains JSON-serializable (persistable)', () => {
    const { trace } = scoreAssessment('phase-g-json', buildUniformAnswers(0));
    const findings = deriveFindings(trace, {
      evidenceByTheme: { board_oversight_gap: 'DOCUMENTED' },
    });
    const record = buildTraceabilityRecord('phase-g-json', trace, findings);
    expect(() => JSON.parse(JSON.stringify(record))).not.toThrow();
  });
});
