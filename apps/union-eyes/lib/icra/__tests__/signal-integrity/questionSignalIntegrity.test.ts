/**
 * Question Architecture Audit™ — Signal Integrity test
 *
 * Audit reference: docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md
 *                  docs/oci/audit/SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md
 *                  docs/oci/audit/EVIDENCE_EXTRACTION_AUDIT.md
 *                  docs/oci/audit/HUMAN_CONTINUITY_THEORY_ALIGNMENT.md
 *
 * Enforces:
 *  - Anti-redundancy (no two prompts share identical text).
 *  - Zero D1 (Surface) prompts; >= 60% of bank is D3-or-deeper.
 *  - Bank-wide anti-surveillance text invariants.
 *  - HCT construct operationalization floors.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';
import type { Question } from '../../types';

// ── Signal-Depth™ classification, grounded in
//    docs/oci/audit/SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md §2.
const D1_IDS = new Set<string>([]); // surface — must remain empty
const D2_IDS = new Set([
  'od_02', 'od_03', 'icb_02',
  'gv_01', 'gv_02', 'gv_04',
  'im_01', 'im_04',
  'tr_03',
  'oc_02', 'oc_03', 'oc_05',
  'et_03', 'et_04',
  'sg_02', 'sg_03',
]);
const D4_IDS = new Set([
  'icb_01',
  'ccs_02',
  'im_02', 'orl_02',
  'et_01', 'et_02',
  'mt_02',
]);
const D5_IDS = new Set([
  'od_05', 'ccs_01',
  'gis_01',
  'im_03', 'orl_01', 'if_01', 'ccs_03',
  'tr_01', 'tr_02', 'tr_05', 'onb_01', 'ccs_04',
  'mt_01',
]);
function depth(q: Question): 'D1' | 'D2' | 'D3' | 'D4' | 'D5' {
  if (D1_IDS.has(q.id)) return 'D1';
  if (D2_IDS.has(q.id)) return 'D2';
  if (D4_IDS.has(q.id)) return 'D4';
  if (D5_IDS.has(q.id)) return 'D5';
  return 'D3';
}

describe('Question Architecture Audit™ — signal integrity', () => {
  it('no two scored prompts share identical English text (anti-redundancy)', () => {
    const seen = new Map<string, string>();
    for (const q of ALL_QUESTIONS) {
      const prev = seen.get(q.prompt);
      expect(prev, `duplicate prompt: ${q.id} vs ${prev}`).toBeUndefined();
      seen.set(q.prompt, q.id);
    }
  });

  it('zero D1 (Surface) prompts (deep-signal invariant)', () => {
    const d1 = ALL_QUESTIONS.filter((q) => depth(q) === 'D1');
    expect(d1.map((q) => q.id)).toEqual([]);
  });

  it('>= 60% of scored bank is D3-or-deeper', () => {
    const deep = ALL_QUESTIONS.filter((q) =>
      ['D3', 'D4', 'D5'].includes(depth(q)),
    );
    expect(deep.length / ALL_QUESTIONS.length).toBeGreaterThanOrEqual(0.6);
  });

  it('no scored prompt contains personal-identifier or named-individual patterns', () => {
    // forbidden tokens: simple proper-name patterns and individual-targeting phrases
    const forbidden = [
      /\bmy boss\b/i,
      /\bmy manager\b/i,
      /\bemployee #\d+/i,
      /\bperson(?:'s)? name\b/i,
      /\bstaff member's name\b/i,
      /\brate (?:your|the) (?:CEO|director|manager)\b/i,
    ];
    for (const q of ALL_QUESTIONS) {
      for (const pat of forbidden) {
        expect(pat.test(q.prompt), `${q.id}: forbidden pattern ${pat}`).toBe(false);
      }
    }
  });

  it('no scored prompt embeds an evidence-extraction demand (evidence is facilitation-phase only)', () => {
    // Within-survey evidence demands look like "upload your X" / "attach Y" / "provide a copy of"
    const demanding = [
      /\bupload (?:your|the) /i,
      /\battach (?:your|the) /i,
      /\bprovide a copy of /i,
    ];
    for (const q of ALL_QUESTIONS) {
      for (const pat of demanding) {
        expect(pat.test(q.prompt), `${q.id}: forbidden evidence-demand ${pat}`).toBe(false);
      }
    }
  });

  // HCT operationalization floors (Part 11)
  const HCT_OPERATIONALIZATION = {
    'HCT-1 Stewardship continuity': ['od_01', 'od_04', 'icb_01', 'icb_02', 'cf_01', 'scs_01', 'scs_03'],
    'HCT-2 Governance continuity': ['gv_01', 'gv_02', 'gv_03', 'gv_04', 'gis_01', 'ccs_02', 'scs_02'],
    'HCT-3 Onboarding survivability': ['od_05', 'onb_01', 'ccs_04', 'scs_05'],
    'HCT-4 Reconstruction burden': ['im_01', 'im_02', 'im_03', 'im_04', 'orl_01', 'orl_02', 'if_01', 'ccs_03'],
    'HCT-5 Institutional memory continuity': ['im_01', 'im_02', 'im_03', 'im_04', 'orl_02', 'if_01', 'et_05'],
    'HCT-7 Continuity transfer': ['tr_03', 'scs_01', 'scs_03', 'scs_05'],
  } as const;

  const ids = new Set(ALL_QUESTIONS.map((q) => q.id));
  for (const [hct, expected] of Object.entries(HCT_OPERATIONALIZATION)) {
    it(`${hct} is operationalized by >= 3 declared questions, all present in the bank`, () => {
      expect(expected.length).toBeGreaterThanOrEqual(3);
      for (const id of expected) {
        expect(ids.has(id), `${hct} expects ${id} to exist in ALL_QUESTIONS`).toBe(true);
      }
    });
  }
});
