import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const PROPERTY_SUITE = join(ROOT, 'security', 'redteam', 'property-based.test.ts')

function readContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

describe('Property-based scale enforcement', () => {
  it('maintains a dedicated red-team property-based suite', () => {
    expect(existsSync(PROPERTY_SUITE)).toBe(true)

    const source = readContent(PROPERTY_SUITE)
    expect(source).toContain("import fc from 'fast-check'")
    expect(source).toContain('describe(\'PROP-001')
    expect(source).toContain('describe(\'PROP-004')
  })

  it('covers core security surfaces: sanitization, org IDs, rate limits, and hashing', () => {
    const source = readContent(PROPERTY_SUITE)

    expect(source).toContain('function sanitizeField')
    expect(source).toContain('function isValidOrgId')
    expect(source).toContain('function rateLimitKey')
    expect(source).toContain("createHash('sha256')")
  })

  it('runs property checks at scale rather than token sample sizes', () => {
    const source = readContent(PROPERTY_SUITE)
    const numRuns = [...source.matchAll(/numRuns:\s*(\d+)/g)].map((match) => Number.parseInt(match[1], 10))

    expect(numRuns.length).toBeGreaterThanOrEqual(8)
    expect(numRuns.some((value) => value >= 10000)).toBe(true)
    expect(numRuns.every((value) => value >= 5000)).toBe(true)
  })
})