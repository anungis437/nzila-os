/**
 * Question Architecture Audit™ — Entropy Coverage test
 *
 * Audit reference: docs/oci/audit/ENTROPY_SIGNAL_GAP_REPORT.md
 *
 * Enforces:
 *  - Every Governance-Entropy-Scale (GES) ordinal 1..4 has >= 3 declared inputs
 *    in the bank.
 *  - GES ordinals 1..3 have >= 2 distinct modalities feeding them.
 *
 * GES ordinal 5 currently has no direct probe (Finding E-1) — tracked as a
 * `.todo` invariant. Resolves in v1.2.0 per QUESTION_REDESIGN_ROADMAP.md
 * item R-C1.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';
import type { Question } from '../../types';

// Inputs declared in ENTROPY_SIGNAL_GAP_REPORT.md §1.
const GES_INPUTS: Record<1 | 2 | 3 | 4, readonly string[]> = {
  1: ['gv_01', 'gv_02', 'ccs_02', 'gis_01', 'im_01', 'im_03', 'orl_02', 'ccs_03'],
  2: ['gv_04', 'gis_01', 'orl_02', 'et_01', 'et_05'],
  3: ['gv_03', 'gis_01', 'et_01', 'et_02', 'scs_02'],
  4: ['gv_03', 'orl_01', 'et_02', 'tr_02', 'scs_03'],
};

const byId = new Map<string, Question>(ALL_QUESTIONS.map((q) => [q.id, q]));

describe('Question Architecture Audit™ — entropy coverage', () => {
  for (const [ordStr, ids] of Object.entries(GES_INPUTS) as Array<[string, readonly string[]]>) {
    const ord = Number(ordStr) as 1 | 2 | 3 | 4;

    it(`GES ordinal ${ord} has >= 3 declared inputs present in the bank`, () => {
      const present = ids.filter((id) => byId.has(id));
      expect(present.length).toBeGreaterThanOrEqual(3);
    });

    if (ord === 1) {
      // Ordinal 1 mixes modalities (maturity ladder + confidence sensing).
      // Ordinals 2..4 are maturity-only in v1.1.0; Roadmap R-H6 introduces
      // modality diversity at higher entropy bands in v1.2.0.
      it(`GES ordinal ${ord} carries >= 2 distinct modalities`, () => {
        const present = ids.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
        const modalities = new Set(present.map((q) => q.type));
        expect(modalities.size).toBeGreaterThanOrEqual(2);
      });
    }
  }

  // v1.2.0 — once R-C1 / R-H6 ship:
  it.todo('GES level 5 has >= 1 direct `multiple_choice` topology probe');
  it.todo(
    'reviewer escalation to GES level 5 requires >= 3 risk-inverted inputs in the entropy audit packet',
  );
  it.todo('GES ordinal 2 carries >= 2 distinct modalities');
  it.todo('GES ordinal 3 carries >= 2 distinct modalities');
  it.todo('GES ordinal 4 carries >= 2 distinct modalities');
});
