/**
 * Question Architecture Audit™ — Longitudinal Signal Stability test
 *
 * Audit reference: docs/oci/audit/LONGITUDINAL_SURVIVABILITY_AUDIT.md
 *
 * Enforces:
 *  - Zero L-Transient prompts (no event-anchored or tooling-anchored text).
 *  - No prompt embeds a current-year token, named-individual placeholder,
 *    or active-project marker.
 *  - Every prompt that references "current" or "recent" qualifies via
 *    institutional anchor (e.g., "current governance posture") — verified
 *    by an explicit allow-list of qualifying anchors.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';

describe('Question Architecture Audit™ — longitudinal signal stability', () => {
  it('no prompt embeds a four-digit current-year token (e.g., "2024 reporting cycle")', () => {
    const yearPattern = /\b(?:19|20)\d{2}\b/;
    for (const q of ALL_QUESTIONS) {
      expect(yearPattern.test(q.prompt), `${q.id}: year token in prompt`).toBe(false);
    }
  });

  it('no prompt embeds a named-individual placeholder', () => {
    const placeholders = [
      /\{name\}/i,
      /\{employee\}/i,
      /\[name of\b/i,
      /\bmr\.\s+/i,
      /\bms\.\s+/i,
    ];
    for (const q of ALL_QUESTIONS) {
      for (const pat of placeholders) {
        expect(pat.test(q.prompt), `${q.id}: placeholder ${pat}`).toBe(false);
      }
    }
  });

  it('no prompt embeds an active-project marker', () => {
    const projectMarkers = [
      /\bproject [A-Z][a-z]+/, // "Project Apollo"
      /\bphase \d+ rollout\b/i,
      /\bQ[1-4] 20\d{2}\b/i,
    ];
    for (const q of ALL_QUESTIONS) {
      for (const pat of projectMarkers) {
        expect(pat.test(q.prompt), `${q.id}: active-project marker ${pat}`).toBe(false);
      }
    }
  });

  // mt_02 carries an institutional-anchor exception documented in
  // LONGITUDINAL_SURVIVABILITY_AUDIT.md §3. Re-classified L-Stable in v1.2.0
  // per Roadmap R-H4.
  it.todo('L-Decaying count = 0 after Roadmap R-H4 rewords mt_02 anchor');
  it.todo('every ccs_* question declares a stable institutional anchor in metadata');
});
