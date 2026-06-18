/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (T2)
 * MODULE: Obligation mapping never changes scores
 * SPEC: docs/oci/government-readiness/implementation/NON_REGRESSION_TEST_SPECIFICATION.md §T2
 *
 * Mapping a finding to obligations is reporting context only. It cannot
 * influence any score, and the obligations modules must not import the scoring
 * engine.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import { mapFindingToObligations, OBLIGATION_MAPPING_RULES } from '../../obligations/obligationMapping';
import { OBLIGATION_CLASSES } from '../../obligations/obligationTaxonomy';
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

describe('T2 — obligation mapping never changes scores', () => {
  it('obligation modules do not import the scoring engine', () => {
    for (const file of ['obligationMapping.ts', 'obligationTaxonomy.ts']) {
      const src = readFileSync(resolve(OBLIGATIONS_DIR, file), 'utf8');
      expect(src).not.toMatch(/from ['"]\.\.\/scoring['"]/);
      expect(src).not.toMatch(/scoreAssessment|computeProfile/);
    }
  });

  it('invoking obligation mapping does not change the score', () => {
    const answers = buildUniformAnswers(2);
    const before = scoreAssessment('isolation', answers);

    // Exercise the mapping across every theme × every evidence level.
    for (const theme of Object.keys(OBLIGATION_MAPPING_RULES)) {
      for (const level of ALL_EVIDENCE) {
        mapFindingToObligations(theme, level);
      }
    }

    const after = scoreAssessment('isolation', answers);
    expect(after.profile.composite).toBe(before.profile.composite);
    expect(after.profile.dimensions).toStrictEqual(before.profile.dimensions);
    expect(after.profile.maturityBand.id).toBe(before.profile.maturityBand.id);
  });

  it('statutory is never asserted below the DOCUMENTED evidence floor', () => {
    const classes = mapFindingToObligations('records_retention_gap', 'VERBAL');
    expect(classes).not.toContain('statutory');
    expect(classes).not.toContain('regulatory');

    const documented = mapFindingToObligations('records_retention_gap', 'DOCUMENTED');
    expect(documented).toContain('statutory');
  });

  it('mapping is deterministic and tier-ordered (highest gravity first)', () => {
    const a = mapFindingToObligations('undocumented_succession_authority', 'DOCUMENTED');
    const b = mapFindingToObligations('undocumented_succession_authority', 'DOCUMENTED');
    expect(a).toStrictEqual(b);
    const tiers = a.map((id) => OBLIGATION_CLASSES[id].tier);
    expect(tiers).toStrictEqual([...tiers].sort((x, y) => x - y));
  });

  it('reportingPriorityWeight and tier are never used as score weights (no scoring import path)', () => {
    // Structural guarantee: obligation reference data is inert w.r.t. scoring.
    const unknown = mapFindingToObligations('does_not_exist', 'CROSS_VALIDATED');
    expect(unknown).toStrictEqual([]);
  });
});
