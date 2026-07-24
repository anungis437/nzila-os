/**
 * Phase 0C.2 §BR-6 — targeted-batch project filter regression guard.
 *
 * `scripts/lifecycle/run.ts` step 10 now consults `PLAYWRIGHT_PROJECTS`
 * (comma- or whitespace-separated) and, when non-empty, adds one
 * `--project <name>` argument per entry to the `playwright test` command.
 *
 * This is the primary mechanism for §BR-6 targeted batches A-F and for the
 * §BR-8 per-project independent-validation acceptance checks. If the
 * parsing helper regresses (e.g. splits incorrectly, drops entries, or
 * fails to normalise), the whole staged-remediation strategy breaks
 * silently — a full run would still succeed for the "all projects" case
 * because the filter is opt-in, but every §BR-6 / §BR-8 batch would
 * silently execute every project.
 *
 * This test pins the pure parser contract statically, complementing the
 * §BR-4 lifecycle-teardown guard.
 *
 * References:
 *   - reports/audits/cupe-national-phase-0/phase-0c/
 *     phase-0c2-baseline-remediation-targeted-batches.md
 *   - apps/union-eyes/scripts/lifecycle/run.ts § `parseProjectFilter`
 *   - apps/union-eyes/playwright.config.ts § `PLAYWRIGHT_PROJECT_MANIFEST`
 */
import { describe, it, expect } from 'vitest'

import { parseProjectFilter } from '../scripts/lifecycle/run'

describe('Phase 0C.2 §BR-6 — parseProjectFilter', () => {
  it('returns [] for undefined input (default = run all wired projects)', () => {
    expect(parseProjectFilter(undefined)).toEqual([])
  })

  it('returns [] for null input', () => {
    expect(parseProjectFilter(null)).toEqual([])
  })

  it('returns [] for the empty string', () => {
    expect(parseProjectFilter('')).toEqual([])
  })

  it('returns [] for whitespace-only input', () => {
    expect(parseProjectFilter('   \t \n ')).toEqual([])
  })

  it('parses a single project name', () => {
    expect(parseProjectFilter('public')).toEqual(['public'])
  })

  it('parses a comma-separated list', () => {
    expect(parseProjectFilter('setup,public')).toEqual(['setup', 'public'])
  })

  it('parses a whitespace-separated list', () => {
    expect(parseProjectFilter('setup public admin')).toEqual([
      'setup',
      'public',
      'admin',
    ])
  })

  it('parses a mixed comma + whitespace list', () => {
    expect(parseProjectFilter('setup, member  steward,admin')).toEqual([
      'setup',
      'member',
      'steward',
      'admin',
    ])
  })

  it('strips surrounding whitespace from each entry', () => {
    expect(parseProjectFilter('  setup ,  public  ,  admin  ')).toEqual([
      'setup',
      'public',
      'admin',
    ])
  })

  it('drops empty entries produced by adjacent separators', () => {
    expect(parseProjectFilter('setup,,,,public')).toEqual(['setup', 'public'])
    expect(parseProjectFilter(',setup,')).toEqual(['setup'])
  })

  it('preserves declaration order (Playwright ANDs repeated --project flags by union)', () => {
    expect(parseProjectFilter('admin,setup,public')).toEqual([
      'admin',
      'setup',
      'public',
    ])
  })

  it('preserves duplicates (caller may pass them; Playwright dedupes downstream)', () => {
    // We do NOT dedupe here — de-duplication is Playwright's concern. Keeping
    // the parser identity-preserving lets an operator audit the exact list
    // they passed via the env var without silent transformations.
    expect(parseProjectFilter('setup,setup,admin')).toEqual([
      'setup',
      'setup',
      'admin',
    ])
  })

  it('accepts hyphenated project names (bilingual-en, bilingual-fr)', () => {
    expect(parseProjectFilter('bilingual-en,bilingual-fr')).toEqual([
      'bilingual-en',
      'bilingual-fr',
    ])
  })

  it('supports the six §BR-6 canonical batches (A, B, C, D, E, F)', () => {
    // Batch A — public (no auth)
    expect(parseProjectFilter('setup,public')).toEqual(['setup', 'public'])
    // Batch B — member + steward + staff + executive
    expect(
      parseProjectFilter('setup,member,steward,staff,executive'),
    ).toEqual(['setup', 'member', 'steward', 'staff', 'executive'])
    // Batch C — admin alone
    expect(parseProjectFilter('setup,admin')).toEqual(['setup', 'admin'])
    // Batch D — security
    expect(parseProjectFilter('setup,security')).toEqual([
      'setup',
      'security',
    ])
    // Batch E — bilingual-en + bilingual-fr
    expect(parseProjectFilter('setup,bilingual-en,bilingual-fr')).toEqual([
      'setup',
      'bilingual-en',
      'bilingual-fr',
    ])
    // Batch F — accessibility
    expect(parseProjectFilter('setup,accessibility')).toEqual([
      'setup',
      'accessibility',
    ])
  })
})
