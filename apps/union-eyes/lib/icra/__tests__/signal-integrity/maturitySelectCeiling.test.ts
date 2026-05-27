/**
 * Question Architecture Audit™ — Maturity-Select Ceiling test
 *
 * Audit reference: docs/oci/audit/QUESTION_ARCHITECTURE_INVENTORY.md (Finding M-1)
 *                  docs/oci/assessment/OCI_MODALITY_DOCTRINE.md
 *                  docs/oci/audit/QUESTION_REDESIGN_ROADMAP.md (Roadmap R-H1)
 *
 * Doctrine target band: maturity_select share is 65–75 % of the scored bank.
 * Current state: 42 / 54 = 77.8 % — breach above the 75 % ceiling.
 *
 * Strategy:
 *  - A hard assertion records the *current observed* share so any regression
 *    above today's level fails the build (no further erosion of modality
 *    diversity is acceptable).
 *  - A `.todo` records the doctrine target — flipped to a hard assertion
 *    once Roadmap R-H1 (v1.2.0) reconverts the targeted maturity items
 *    into multiple_choice / likert_5 inputs.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';

describe('Question Architecture Audit™ — maturity_select ceiling', () => {
  const total = ALL_QUESTIONS.length;
  const maturity = ALL_QUESTIONS.filter((q) => q.type === 'maturity_select').length;
  const share = maturity / total;

  it('does not regress beyond the currently observed maturity_select share', () => {
    // Today's observed share is 77.8 %. Any change pushing this UP is a
    // doctrine regression beyond the existing breach.
    expect(share).toBeLessThanOrEqual(0.78);
  });

  it('reports the current bank composition (diagnostic)', () => {
    expect(maturity).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });

  it('maturity_select share within doctrine band 0.65..0.75', () => {
    expect(share).toBeGreaterThanOrEqual(0.65);
    expect(share).toBeLessThanOrEqual(0.75);
  });
});
