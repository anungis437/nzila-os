/**
 * UE_VOCABULARY_001 — "Forbidden marketing vocabulary"
 *
 * Hard-fails if Union Eyes marketing surfaces (app routes + locale messages)
 * contain corporate-ownership / founder-control vocabulary that conflicts with
 * the institutional-governance thesis.
 *
 * Allowed only inside:
 *   - apps/union-eyes/app/[locale]/(marketing)/trust/stewardship-appendix/
 *   - docs/
 *
 * @invariant UE_VOCABULARY_001
 */
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { ROOT, walkSync, readContent, relPath, formatViolations, type Violation } from './governance-helpers'
import {
  FORBIDDEN_PHRASES,
  isAllowedPath,
  scanForForbiddenPhrases,
} from '../marketing/forbidden-vocabulary'

const UE_ROOT = 'apps/union-eyes'

/**
 * Repo-relative dirs to scan, with file extensions to include.
 *
 * Scope is intentionally narrow: only the public marketing route group.
 * Internal product features (Class B governance admin console, governance
 * API routes, shared i18n message bundles that include the governance admin
 * namespace) legitimately reference "golden share" etc. as domain terms and
 * are out of scope for this rule. Marketing copy that is i18n'd is read from
 * those same JSON files via translation keys — the (marketing) TSX scan
 * catches any inlined marketing prose drift.
 */
const SCAN_TARGETS: ReadonlyArray<{ dir: string; exts: string[] }> = [
  { dir: `${UE_ROOT}/app/[locale]/(marketing)`, exts: ['.ts', '.tsx', '.mdx', '.md'] },
]

function isExcludedPath(rel: string): boolean {
  if (/\.(test|spec)\.[jt]sx?$/.test(rel)) return true
  if (rel.includes('__tests__/')) return true
  return false
}

describe('UE_VOCABULARY_001 — forbidden marketing vocabulary', () => {
  it('forbidden list is non-empty (sanity)', () => {
    expect(FORBIDDEN_PHRASES.length).toBeGreaterThan(0)
  })

  it('no Union Eyes marketing surface uses forbidden phrases (outside allowlist)', { timeout: 60_000 }, () => {
    const violations: Violation[] = []

    for (const target of SCAN_TARGETS) {
      const dir = join(ROOT, target.dir)
      const files = walkSync(dir, target.exts)
      for (const file of files) {
        const rel = relPath(file)
        if (isExcludedPath(rel)) continue
        if (isAllowedPath(rel)) continue

        const content = readContent(file)
        if (!content) continue
        const hits = scanForForbiddenPhrases(content)
        for (const hit of hits) {
          // Compute approximate line number from the original (non-normalized) content.
          const lower = content.toLowerCase()
          const lineIndex = lower.indexOf(hit.phrase.toLowerCase())
          const line = lineIndex === -1 ? 0 : content.slice(0, lineIndex).split('\n').length
          violations.push({
            ruleId: 'UE_VOCABULARY_001',
            filePath: rel,
            line,
            snippet: hit.phrase,
            offendingValue: hit.phrase,
            remediation:
              'Remove or rephrase. Corporate-stewardship vocabulary is permitted only in /trust/stewardship-appendix or internal docs/.',
          })
        }
      }
    }

    expect(
      violations,
      `Forbidden marketing vocabulary found:\n\n${formatViolations(violations)}`,
    ).toHaveLength(0)
  })
})
