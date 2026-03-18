/**
 * Contract Test — No Direct Stripe SDK (STUDIO-STRIPE-01)
 *
 * Verifies:
 *   No app may use `new Stripe(` to instantiate raw Stripe clients.
 *   All Stripe usage MUST go through `@nzila/payments-stripe` (via
 *   `getStripeClient()`) or through the app's `lib/stripe.ts` bridge.
 *
 *   Type-only imports (`import type Stripe from 'stripe'`) are permitted.
 *   The `@nzila/payments-stripe` package itself is exempt (it wraps the SDK).
 *
 * This prevents apps from bypassing the platform's Stripe configuration,
 * webhook verification, and observability layer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

const APPS = [
  'console',
  'partners',
  'web',
  'union-eyes',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
]

function findFiles(dir: string, exts = ['.ts', '.tsx']): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  function recurse(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.next', '.turbo', '_legacy', 'dist'].includes(entry.name)) continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) recurse(full)
      else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) results.push(full)
    }
  }
  recurse(dir)
  return results
}

describe('No direct Stripe SDK instantiation', () => {
  for (const app of APPS) {
    const appDir = resolve(ROOT, 'apps', app)
    if (!existsSync(appDir)) continue

    const files = findFiles(appDir)
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Match `new Stripe(` but not in comments
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('//') || line.startsWith('*')) continue
        if (line.includes('new Stripe(')) {
          const rel = file.replace(appDir, app)
          violations.push(`${rel}:${i + 1}`)
        }
      }
    }

    it(`${app} — no 'new Stripe(' instantiation`, () => {
      expect(
        violations,
        `Found direct Stripe instantiation:\n${violations.join('\n')}`,
      ).toEqual([])
    })
  }
})
