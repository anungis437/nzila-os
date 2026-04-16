import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { relPath } from './governance-helpers'
import { loadAllMaturities, routeFilesForApp } from './hardening-helpers'

const ACTIVE_STATUSES = new Set(['production', 'pilot', 'internal'])
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /TODO/gi, reason: 'TODO in API handler' },
  { pattern: /return\s+(?:await\s+)?(?:demoData|mock\w+|fallback\w+)/gi, reason: 'fake or fallback response returned from API handler' },
  { pattern: /if\s*\([^\n)]*!db[^\n)]*\)\s*return\s+\w*fallback\w*/gi, reason: 'database fallback used in runtime path' },
]

describe('No fake production behavior in runtime APIs', () => {
  const maturities = loadAllMaturities()

  it('forbids TODOs and fake fallbacks in active app API handlers', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (!ACTIVE_STATUSES.has(maturity.status)) continue

      for (const filePath of routeFilesForApp(app)) {
        const source = readFileSync(filePath, 'utf8')
        const explicitDemoSurface = /[\\/]pilot[\\/]/.test(filePath) || source.includes('NZILA_MODE')

        for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
          if (explicitDemoSurface && /demo|fallback/i.test(reason)) continue
          if (pattern.test(source)) {
            violations.push(`${relPath(filePath)}: ${reason}`)
          }
          pattern.lastIndex = 0
        }
      }
    }

    expect(violations).toEqual([])
  })
})
