import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { relPath } from './governance-helpers'
import { loadAllMaturities, routeFilesForApp } from './hardening-helpers'

describe('API completeness', () => {
  const maturities = loadAllMaturities()

  it('pilot and production routes expose handlers, structured responses, and validation for JSON bodies', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (!new Set(['pilot', 'production']).has(maturity.status)) continue

      for (const filePath of routeFilesForApp(app)) {
        if (/[\\/]app[\\/]api[\\/](?:auth|version|ready|auth_core|rights)[\\/]/.test(filePath)) continue

        const source = readFileSync(filePath, 'utf8')
        const readsJsonBody = /\.json\(\)/.test(source)
        const hasValidation = /safeParse\(|parse\(|z\.object\(|body:\s*\w+Schema|withApi\(/.test(source)
        const nonTrivialRoute = source.trim().length > 120

        if (!nonTrivialRoute) violations.push(`${relPath(filePath)}: route implementation is suspiciously empty`)
        if (maturity.contracts_complete && readsJsonBody && !hasValidation) {
          violations.push(`${relPath(filePath)}: request body is not validated`)
        }
        if (/TODO/.test(source)) violations.push(`${relPath(filePath)}: TODO in API route`)
      }
    }

    expect(violations).toEqual([])
  })
})
