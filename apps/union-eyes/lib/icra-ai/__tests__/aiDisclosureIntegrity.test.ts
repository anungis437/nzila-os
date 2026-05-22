import { describe, expect, it } from 'vitest';
import {
  AI_DISCLOSURE_COPY,
  AI_DISCLOSURE_VERSION,
  AI_UX_FORBIDDEN_PHRASES,
} from '../aiDisclosureCopy';

describe('AI disclosure copy integrity', () => {
  it('pins the en-CA canonical disclosure verbatim', () => {
    expect(AI_DISCLOSURE_COPY['en-CA']).toBe(
      'Certain narrative summaries in this report may be AI-assisted. ' +
        'Findings remain grounded in structured continuity signals, ' +
        'deterministic assessment logic, and reviewer-led interpretation.',
    );
  });

  it('pins the fr-CA canonical disclosure verbatim', () => {
    expect(AI_DISCLOSURE_COPY['fr-CA']).toBe(
      'Certains résumés narratifs de ce rapport peuvent être assistés ' +
        "par IA. Les constats demeurent fondés sur des signaux structurés " +
        "de continuité, une logique d'évaluation déterministe et une " +
        'interprétation menée par un réviseur.',
    );
  });

  it('exposes a stable disclosure version', () => {
    expect(AI_DISCLOSURE_VERSION).toBe('1.0.0');
  });

  it('forbidden UX phrases include autonomous-judgment claims', () => {
    expect(AI_UX_FORBIDDEN_PHRASES).toContain('AI evaluated your organization');
    expect(AI_UX_FORBIDDEN_PHRASES).toContain('AI predicted');
  });
});
