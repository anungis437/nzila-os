/**
 * Forbidden marketing vocabulary for Union Eyes.
 *
 * These phrases conflate Union Eyes with corporate-ownership / founder-control
 * positioning and undermine the "institutional governance & continuity
 * infrastructure for federated democratic organizations" thesis.
 *
 * Allowed only inside the disclosed corporate stewardship appendix
 * (`/trust/stewardship-appendix`) and internal `docs/`.
 *
 * Matching is case-insensitive and whitespace-collapsed.
 */

export const FORBIDDEN_PHRASES: readonly string[] = [
  'golden share',
  'founder override',
  'ownership protection',
  'control mechanics',
  'shareholder structure',
  'governance lock',
] as const

/**
 * Path prefixes (forward-slash, repo-relative) where forbidden phrases are
 * permitted because they belong to the disclosed corporate stewardship
 * appendix or internal documentation.
 */
export const ALLOWED_PATH_PREFIXES: readonly string[] = [
  'apps/union-eyes/app/[locale]/(marketing)/trust/stewardship-appendix/',
  'docs/',
] as const

export function isAllowedPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/')
  return ALLOWED_PATH_PREFIXES.some((p) => normalized.startsWith(p))
}

export interface VocabularyHit {
  phrase: string
  index: number
}

/**
 * Scan a text blob for forbidden phrases. Case-insensitive,
 * whitespace-tolerant (collapses runs of whitespace before matching).
 */
export function scanForForbiddenPhrases(content: string): VocabularyHit[] {
  const hits: VocabularyHit[] = []
  const normalized = content.toLowerCase().replace(/\s+/g, ' ')
  for (const phrase of FORBIDDEN_PHRASES) {
    const needle = phrase.toLowerCase()
    let from = 0
    while (true) {
      const idx = normalized.indexOf(needle, from)
      if (idx === -1) break
      hits.push({ phrase, index: idx })
      from = idx + needle.length
    }
  }
  return hits
}
