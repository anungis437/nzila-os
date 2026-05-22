/**
 * Anti-Gimmick Invariant — enforces the calm, institutionally-serious tone
 * mandated by docs/oci/assessment/OCI_MODALITY_DOCTRINE.md §7.
 *
 * Forbidden vocabulary across all question prompts, help text, options,
 * and option labels.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../questions';

const FORBIDDEN_VOCAB = [
  // quiz/gamification
  /\bquiz\b/i,
  /\bgame\b/i,
  /\bgamified?\b/i,
  /\bleaderboard\b/i,
  // ranking / comparative
  /\bbest[- ]in[- ]class\b/i,
  /\bworst[- ]in[- ]class\b/i,
  /\btop[- ]performers?\b/i,
  /\bpercentile\b/i,
  // engagement / marketing
  /\boptimize\b/i,
  /\bdisrupt\b/i,
  /\bseamless\b/i,
  /\bleverage\b/i,
  /\bsynergy\b/i,
  /\bempower\b/i,
  /\brevolutioniz(e|ing)\b/i,
  // affective / quiz framings (the word "personality" is intentionally NOT
  // forbidden — "personality-dependent" is canonical OCI band vocabulary
  // describing the tribal-continuity operational pattern).
  /\bpersonality\s+(test|quiz|profile)\b/i,
  /\bhow do you feel\b/i,
  /\brate yourself\b/i,
  // surveillance phrasing
  /\bperformance score\b/i,
  /\bproductivity score\b/i,
];

function collectText(): string[] {
  const out: string[] = [];
  for (const q of ALL_QUESTIONS) {
    out.push(q.prompt);
    if (q.helpText) out.push(q.helpText);
    if (q.rationale) out.push(q.rationale);
    if (q.type === 'likert_5') {
      out.push(q.scale.minLabel, q.scale.maxLabel);
    } else {
      for (const o of q.options) {
        out.push(o.label);
        if (o.observation) out.push(o.observation);
      }
    }
  }
  return out;
}

describe('Anti-gimmick invariant', () => {
  const corpus = collectText();

  it('no question text contains forbidden quiz / gamification vocabulary', () => {
    for (const text of corpus) {
      for (const pattern of FORBIDDEN_VOCAB) {
        expect(pattern.test(text), `forbidden term in: "${text}"`).toBe(false);
      }
    }
  });

  it('no question references named individuals or named departments', () => {
    // Heuristic: questions should never use first-person-name placeholders
    const namedPatterns = [/\b(John|Jane|Bob|Alice|Mr\.|Ms\.|Dr\.)\b/];
    for (const text of corpus) {
      for (const p of namedPatterns) {
        expect(p.test(text), `named-individual reference in: "${text}"`).toBe(false);
      }
    }
  });

  it('likert prompts are statements, not opinion probes', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'likert_5') continue;
      // statements typically end with a period; opinion probes typically end with '?'
      expect(q.prompt.trim().endsWith('?'), `likert ${q.id} is phrased as a question`).toBe(false);
    }
  });

  it('multiple_choice questions do not present a "correct" option label', () => {
    const forbiddenOptionMarkers = [/\bcorrect\b/i, /\bright answer\b/i, /\bbest answer\b/i];
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'multiple_choice') continue;
      for (const o of q.options) {
        for (const p of forbiddenOptionMarkers) {
          expect(p.test(o.label), `mc ${q.id} option "${o.label}" marks correctness`).toBe(false);
        }
      }
    }
  });
});
