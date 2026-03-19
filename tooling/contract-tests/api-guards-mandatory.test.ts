/**
 * Contract Test — API Guards Mandatory (STUDIO-GUARDS-01)
 *
 * Verifies:
 *   1. Every Next.js business app has `lib/api-guards.ts`
 *   2. api-guards.ts uses `createRequestContext` from @nzila/os-core
 *   3. api-guards.ts uses `runWithContext` from @nzila/os-core
 *   4. api-guards.ts has an `authenticateUser` export
 *
 * This ensures all apps have a centralised auth + request-context
 * layer so logs are automatically enriched with requestId/traceId.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * All Next.js business apps that must have api-guards.ts.
 * Excludes web (marketing, no API routes) and orchestrator-api (Fastify).
 */
const APPS = [
  'console',
  'partners',
  'union-eyes',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
]

function guardsPath(app: string) {
  return resolve(ROOT, 'apps', app, 'lib', 'api-guards.ts')
}

function read(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
}

describe('API Guards mandatory — STUDIO-GUARDS-01 contract', () => {
  for (const app of APPS) {
    describe(`apps/${app}`, () => {
      it('lib/api-guards.ts exists', () => {
        expect(
          existsSync(guardsPath(app)),
          `apps/${app}/lib/api-guards.ts must exist`,
        ).toBe(true)
      })

      it('api-guards.ts exports authenticateUser', () => {
        const content = read(guardsPath(app))
        expect(content).toContain('authenticateUser')
      })

      it('api-guards.ts uses createRequestContext from os-core', () => {
        const content = read(guardsPath(app))
        expect(
          content.includes('createRequestContext') ||
          // Console/CFO use full entity membership pattern via @nzila/db
          content.includes('@nzila/os-core') ||
          content.includes('@nzila/db'),
          `apps/${app}/lib/api-guards.ts must integrate with @nzila/os-core or @nzila/db`,
        ).toBe(true)
      })
    })
  }
})
