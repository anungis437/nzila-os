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
const GES_INPUTS: Record<1 | 2 | 3 | 4 | 5, readonly string[]> = {
  1: ['gv_01', 'gv_02', 'ccs_02', 'gis_01', 'im_01', 'im_03', 'orl_02', 'ccs_03'],
  2: ['gv_04', 'gis_01', 'orl_02', 'et_01', 'et_05', 'ccs_02', 'scs_02'],
  3: ['gv_03', 'gis_01', 'et_01', 'et_02', 'scs_02', 'ccs_04'],
  4: ['gv_03', 'orl_01', 'et_02', 'tr_02', 'scs_03', 'ccs_03'],
  // et_07 is the purpose-built GES-5 multiple_choice topology probe (its
  // 'not_reconstructible' option is the level-5 condition); sg_03 supplies
  // the third risk-inverted GES-5 input after et_02 was reframed to an
  // observable concern-resolution practice in bank v4.
  5: ['scs_04', 'et_07', 'gv_03', 'orl_01', 'sg_03'],
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

  it('GES level 5 has >= 1 direct `multiple_choice` topology probe', () => {
    const level5 = GES_INPUTS[5]
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q));
    const hasDirectMultipleChoice = level5.some((q) => q.type === 'multiple_choice');
    expect(hasDirectMultipleChoice).toBe(true);
  });

  it('reviewer escalation to GES level 5 requires >= 3 risk-inverted inputs in the entropy audit packet', () => {
    const level5 = GES_INPUTS[5]
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q));
    const riskInvertedCount = level5.filter((q) => q.riskInverted === true).length;
    expect(riskInvertedCount).toBeGreaterThanOrEqual(3);
  });

  for (const ord of [2, 3, 4] as const) {
    it(`GES ordinal ${ord} carries >= 2 distinct modalities`, () => {
      const present = GES_INPUTS[ord]
        .map((id) => byId.get(id))
        .filter((q): q is Question => Boolean(q));
      const modalities = new Set(present.map((q) => q.type));
      expect(modalities.size).toBeGreaterThanOrEqual(2);
    });
  }
});
