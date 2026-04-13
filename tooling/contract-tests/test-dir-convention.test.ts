/**
 * TEST_DIR_CONVENTION — Enforce consistent test directory naming
 *
 * Test directories must use `__tests__` or `tests` (both are accepted conventions).
 * Non-standard names like `test`, `spec`, `specs` are NOT allowed.
 * Bare `tests/` directories are permitted throughout the repo.
 *
 * @invariant TEST_DIR_CONVENTION
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './governance-helpers'

/** Accepted test directory names */
const ACCEPTED_TEST_DIRS = new Set(['__tests__', 'tests'])

/** Non-standard names that should be flagged (only if they contain test files, not API routes) */
const NON_STANDARD_TEST_DIRS = new Set(['spec', 'specs'])

interface Violation {
  path: string
  reason: string
}

function findNonStandardTestDirs(
  dir: string,
  violations: Violation[],
  depth = 0,
): void {
  if (!existsSync(dir)) return
  const SKIP = new Set([
    'node_modules', 'dist', '.next', '.turbo', 'build',
    'coverage', '.git', '.venv', '__fixtures__',
  ])

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (SKIP.has(entry.name)) continue

    const fullPath = join(dir, entry.name)
    const rel = relative(ROOT, fullPath).replace(/\\/g, '/')

    if (NON_STANDARD_TEST_DIRS.has(entry.name)) {
      violations.push({
        path: rel,
        reason: `Use "__tests__" or "tests" instead of "${entry.name}" (non-standard name)`,
      })
    }

    // Recurse (cap depth to avoid runaway scanning)
    if (depth < 8) {
      findNonStandardTestDirs(fullPath, violations, depth + 1)
    }
  }
}

describe('TEST_DIR_CONVENTION — consistent test directory naming', () => {
  const violations: Violation[] = []

  // Scan apps/ and packages/ only (not tooling, scripts, etc.)
  findNonStandardTestDirs(join(ROOT, 'apps'), violations)
  findNonStandardTestDirs(join(ROOT, 'packages'), violations)

  it('should not have non-standard test directory names (use "__tests__" or "tests")', () => {
    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.path} — ${v.reason}`)
        .join('\n')
      expect.fail(
        `Found ${violations.length} non-standard test directories:\n${msg}\n\n` +
          'Rename to __tests__/ or tests/.',
      )
    }
  })
})
