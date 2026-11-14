/**
 * Unit tests for governance contract-test helpers and rule logic.
 *
 * Uses __fixtures__/ to verify:
 *   - TS_STRICT_001: detects strict:false, passes strict:true and inherited
 *   - NO_CONSOLE_001: detects console.* usage in fixture code
 *   - ARCH_LAYER_001: detects prohibited DB imports in route fixtures
 *   - Exception loading: validates, detects expired entries
 *   - Violation formatting: produces expected output
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  loadExceptions,
  isExceptionExpired,
  isExcepted,
  formatViolations,
  type Violation,
  type ExceptionEntry,
} from './governance-helpers'

const FIXTURES = resolve(__dirname, '__fixtures__')

// ─── TS_STRICT_001 fixture assertions ───────────────────────────────────────

describe('TS_STRICT_001 — fixture assertions', () => {
  function parseJsonc(filePath: string): Record<string, unknown> {
    const raw = readFileSync(filePath, 'utf-8')
    const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const cleaned = stripped.replace(/,\s*([\]}])/g, '$1')
    return JSON.parse(cleaned)
  }

  it('detects strict:false in tsconfig-strict-false.json', () => {
    const config = parseJsonc(join(FIXTURES, 'tsconfig-strict-false.json'))
    const co = config.compilerOptions as Record<string, unknown>
    expect(co.strict).toBe(false)
  })

  it('passes strict:true in tsconfig-strict-true.json', () => {
    const config = parseJsonc(join(FIXTURES, 'tsconfig-strict-true.json'))
    const co = config.compilerOptions as Record<string, unknown>
    expect(co.strict).toBe(true)
  })

  it('passes inherited config (no strict field)', () => {
    const config = parseJsonc(join(FIXTURES, 'tsconfig-inherited.json'))
    const co = config.compilerOptions as Record<string, unknown>
    expect(co.strict).toBeUndefined()
  })
})

// ─── NO_CONSOLE_001 fixture assertions ──────────────────────────────────────

describe('NO_CONSOLE_001 — fixture assertions', () => {
  const CONSOLE_RE = /\bconsole\.(log|info|warn|error|debug)\s*\(/g

  it('detects console calls in route-with-console.ts', () => {
    const content = readFileSync(
      join(FIXTURES, 'route-with-console.ts'),
      'utf-8',
    )
    const matches = [...content.matchAll(CONSOLE_RE)]
    expect(matches.length).toBeGreaterThanOrEqual(5)
    const methods = matches.map((m) => m[1])
    expect(methods).toContain('log')
    expect(methods).toContain('error')
    expect(methods).toContain('warn')
    expect(methods).toContain('info')
    expect(methods).toContain('debug')
  })

  it('passes route-clean.ts (no console)', () => {
    const content = readFileSync(join(FIXTURES, 'route-clean.ts'), 'utf-8')
    const matches = [...content.matchAll(CONSOLE_RE)]
    expect(matches).toHaveLength(0)
  })
})

// ─── ARCH_LAYER_001 fixture assertions ──────────────────────────────────────

describe('ARCH_LAYER_001 — fixture assertions', () => {
  const DB_IMPORT_RE = /from\s+['"]@nzila\/db(?:\/(?:client|raw|index|schema))?['"]/

  it('detects DB import in route-with-db-import.ts', () => {
    const content = readFileSync(
      join(FIXTURES, 'route-with-db-import.ts'),
      'utf-8',
    )
    expect(DB_IMPORT_RE.test(content)).toBe(true)
  })

  it('passes route-with-service.ts (no DB import)', () => {
    const content = readFileSync(
      join(FIXTURES, 'route-with-service.ts'),
      'utf-8',
    )
    expect(DB_IMPORT_RE.test(content)).toBe(false)
  })
})

// ─── Exception loading ────────────────────────────────────────────────────

describe('Exception loading', () => {
  it('loads valid exception file with correct fields', () => {
    const result = loadExceptions(
      'tooling/contract-tests/__fixtures__/valid-exceptions.json',
    )
    expect(result.ruleId).toBe('TEST_RULE')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].path).toBe('apps/test-app/**')
    expect(result.expiredEntries).toHaveLength(0)
  })

  it('detects expired entries', () => {
    const result = loadExceptions(
      'tooling/contract-tests/__fixtures__/expired-exceptions.json',
    )
    expect(result.ruleId).toBe('EXPIRED_RULE')
    expect(result.expiredEntries).toHaveLength(1)
    expect(result.expiredEntries[0].expiresOn).toBe('2024-01-01')
  })

  it('returns empty for non-existent file', () => {
    const result = loadExceptions('does/not/exist.json')
    expect(result.entries).toHaveLength(0)
    expect(result.expiredEntries).toHaveLength(0)
  })
})

// ─── isExcepted ─────────────────────────────────────────────────────────────

describe('isExcepted', () => {
  const entries: ExceptionEntry[] = [
    {
      path: 'apps/union-eyes/**',
      owner: 'ue',
      justification: 'test',
      expiresOn: '2099-01-01',
    },
    {
      path: 'apps/console/app/api/stripe/**',
      owner: 'pay',
      justification: 'test',
      expiresOn: '2099-01-01',
    },
  ]

  it('matches glob pattern', () => {
    expect(isExcepted('apps/union-eyes/app/api/route.ts', entries)).toBe(true)
  })

  it('matches nested glob', () => {
    expect(
      isExcepted('apps/console/app/api/stripe/checkout/route.ts', entries),
    ).toBe(true)
  })

  it('does not match unrelated path', () => {
    expect(isExcepted('apps/web/app/api/auth/route.ts', entries)).toBe(false)
  })
})

// ─── Violation formatting ───────────────────────────────────────────────────

describe('formatViolations', () => {
  it('formats violations with all fields', () => {
    const violations: Violation[] = [
      {
        ruleId: 'TEST_001',
        filePath: 'apps/web/route.ts',
        line: 10,
        offendingValue: 'console.log',
        snippet: 'console.log("hello")',
        remediation: 'Use logger instead.',
      },
    ]
    const output = formatViolations(violations)
    expect(output).toContain('[TEST_001]')
    expect(output).toContain('apps/web/route.ts:10')
    expect(output).toContain('console.log')
    expect(output).toContain('Use logger instead.')
  })

  it('handles violations without optional fields', () => {
    const violations: Violation[] = [
      {
        ruleId: 'TEST_002',
        filePath: 'apps/web/tsconfig.json',
      },
    ]
    const output = formatViolations(violations)
    expect(output).toContain('[TEST_002]')
    expect(output).toContain('apps/web/tsconfig.json')
  })
})


describe('date-only governance expiry boundaries', () => {
  it.each([
    ['2026-11-13T23:59:59.999Z', false],
    ['2026-11-14T00:00:00.000Z', false],
    ['2026-11-14T23:59:59.999Z', false],
    ['2026-11-15T00:00:00.000Z', true],
  ])('keeps November 14 valid through that UTC date: %s', (at, expired) => {
    expect(isExceptionExpired('2026-11-14', new Date(at))).toBe(expired)
  })
  it.each(['2026-02-30', '2026-13-01', '2026-11-14T12:00Z', 'invalid'])('fails closed for invalid date %s', expiresOn => {
    expect(isExceptionExpired(expiresOn, new Date('2026-11-14T00:00Z'))).toBe(true)
  })
})
