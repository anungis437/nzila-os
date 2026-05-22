/**
 * aiDisclosureCopy
 * ────────────────
 * Canonical bilingual disclosure copy + UX language helpers. Mirrors
 * docs/oci/ai/AI_DISCLOSURE_NOTICE.md.
 */

export const AI_DISCLOSURE_VERSION = '1.0.0' as const;

export type DisclosureLocale = 'en-CA' | 'fr-CA';

export const AI_DISCLOSURE_COPY: Readonly<Record<DisclosureLocale, string>> =
  Object.freeze({
    'en-CA':
      'Certain narrative summaries in this report may be AI-assisted. ' +
      'Findings remain grounded in structured continuity signals, ' +
      'deterministic assessment logic, and reviewer-led interpretation.',
    'fr-CA':
      'Certains résumés narratifs de ce rapport peuvent être assistés ' +
      "par IA. Les constats demeurent fondés sur des signaux structurés " +
      "de continuité, une logique d'évaluation déterministe et une " +
      'interprétation menée par un réviseur.',
  });

/**
 * UX-permitted phrasing for AI-assisted surfaces. Never use the forbidden
 * variants — they are pinned by `aiDisclosureIntegrity.test.ts`.
 */
export const AI_UX_PERMITTED_PHRASES: Readonly<
  Record<DisclosureLocale, ReadonlyArray<string>>
> = Object.freeze({
  'en-CA': Object.freeze([
    'Narrative synthesis',
    'AI-assisted continuity summary',
    'Reviewer-assisted interpretation',
    'Structured continuity interpretation',
  ]),
  'fr-CA': Object.freeze([
    'Synthèse narrative',
    'Résumé de continuité assisté par IA',
    'Interprétation assistée par un réviseur',
    'Interprétation structurée de la continuité',
  ]),
});

/**
 * Phrasing that must never appear in OCRA UX copy. Mirrored in
 * `prohibitedAiPatterns.ts` so AI outputs are blocked too.
 */
export const AI_UX_FORBIDDEN_PHRASES: ReadonlyArray<string> = Object.freeze([
  'AI evaluated your organization',
  'AI identified risk',
  'AI predicted',
  'AI classified your governance',
]);

export function getDisclosure(locale: DisclosureLocale): string {
  return AI_DISCLOSURE_COPY[locale];
}
