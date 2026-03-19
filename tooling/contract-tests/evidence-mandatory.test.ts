/**
 * Contract Test — Evidence Pipeline Mandatory (STUDIO-EV-01)
 *
 * Verifies:
 *   Every business app MUST have a `lib/evidence.ts` that imports from
 *   `@nzila/os-core/evidence` or `@nzila/commerce-audit`.
 *
 *   The marketing site (web) is exempt — it has no mutations to audit.
 *
 * This enforces that every app producing data mutations has an evidence
 * pipeline wired, enabling tamper-proof audit trails across the platform.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/** Apps required to have evidence pipelines */
const EVIDENCE_REQUIRED = [
  'console',
  'union-eyes',
  'partners',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
]

/** Acceptable evidence imports — either os-core/evidence or commerce-audit */
const EVIDENCE_PATTERNS = [
  '@nzila/os-core/evidence',
  '@nzila/commerce-audit',
]

describe('Evidence pipeline mandatory', () => {
  for (const app of EVIDENCE_REQUIRED) {
    it(`${app} — has lib/evidence.ts with evidence import`, () => {
      const evidencePath = resolve(ROOT, 'apps', app, 'lib', 'evidence.ts')
      expect(
        existsSync(evidencePath),
        `${app}/lib/evidence.ts must exist`,
      ).toBe(true)

      const content = readFileSync(evidencePath, 'utf-8')
      const hasEvidence = EVIDENCE_PATTERNS.some((p) => content.includes(p))
      expect(
        hasEvidence,
        `${app}/lib/evidence.ts must import from ${EVIDENCE_PATTERNS.join(' or ')}`,
      ).toBe(true)
    })
  }
})
