/**
 * NO_CONSOLE_001 — "No console in runtime code"
 *
 * Prevents unstructured logging and accidental sensitive output in production.
 *
 * Scope:
 *   apps/** plus runtime packages, excluding:
 *   - **\/*.test.*, **\/*.spec.*, **\/__tests__/**
 *   - **\/scripts/**, **\/tools/**
 *   - tooling/contract-tests/**
 *   - packages/cli/** (dev-only CLI)
 *
 * Rules:
 *   - FAIL if runtime code contains console.log / .info / .warn / .error / .debug
 *   - FAIL if any exception in governance/exceptions/no-console.json is expired
 *   - PASS otherwise
 *
 * @invariant NO_CONSOLE_001
 */
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  ROOT,
  walkSync,
  readContent,
  relPath,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Console pattern ─────────────────────────────────────────────────────────

const CONSOLE_RE = /\bconsole\.(log|info|warn|error|debug)\s*\(/g

// ── Path filters ────────────────────────────────────────────────────────────

/** Paths to scan (runtime code only). */
const SCAN_ROOTS = ['apps']

/** Exclusion patterns (relative paths, forward slashes). */
function isExcludedPath(rel: string): boolean {
  // Test files
  if (/\.(test|spec)\.[jt]sx?$/.test(rel)) return true
  if (rel.includes('__tests__/')) return true
  // Scripts/tools
  if (rel.includes('/scripts/')) return true
  if (rel.includes('/tools/')) return true
  // Seed scripts (CLI-only, not runtime)
  if (rel.includes('/seeds/')) return true
  // Contract tests themselves
  if (rel.startsWith('tooling/contract-tests/')) return true
  // CLI package (dev-only)
  if (rel.startsWith('packages/cli/')) return true
  // Non-runtime config
  if (/\.(config|setup)\.[jt]sx?$/.test(rel)) return true

  return false
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('NO_CONSOLE_001 — No console in runtime code', () => {
  const exceptions = loadExceptions('governance/exceptions/no-console.json')

  it('no governance exceptions are expired', () => {
    expect(
      exceptions.expiredEntries,
      `Expired NO_CONSOLE_001 exceptions:\n${exceptions.expiredEntries
        .map((e) => `  ${e.path} expired ${e.expiresOn} (owner: ${e.owner})`)
        .join('\n')}`,
    ).toHaveLength(0)
  })

  it('no runtime code uses console.* (unless excepted)', () => {
    const violations: Violation[] = []

    for (const scanRoot of SCAN_ROOTS) {
      const dir = join(ROOT, scanRoot)
      const files = walkSync(dir)

      for (const file of files) {
        const rel = relPath(file)
        if (isExcludedPath(rel)) continue
        if (isExcepted(rel, exceptions.entries)) continue

        const content = readContent(file)
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Reset regex
          CONSOLE_RE.lastIndex = 0
          const match = CONSOLE_RE.exec(line)
          if (match) {
            violations.push({
              ruleId: 'NO_CONSOLE_001',
              filePath: rel,
              line: i + 1,
              snippet: line.trim(),
              offendingValue: `console.${match[1]}`,
              remediation:
                'Replace with structured logger from @nzila/os-core/telemetry (e.g., logger.error()).',
            })
          }
        }
      }
    }

    expect(
      violations,
      `Console usage in runtime code:\n\n${formatViolations(violations)}`,
    ).toHaveLength(0)
  })
})
