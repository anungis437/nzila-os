/**
 * Contract Test — Request-ID Propagation (STUDIO-TEL-02)
 *
 * Verifies:
 *   Every app's proxy.ts sets the x-request-id header on responses.
 *   This ensures downstream API routes and server components can call
 *   createRequestContext(req) from @nzila/os-core and get a stable
 *   request ID for correlation logging and distributed tracing.
 *
 *   Edge proxy cannot use node:crypto or node:async_hooks, so the
 *   pattern is: proxy sets x-request-id, Node.js handlers consume it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

const APPS = [
  'console',
  'partners',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
  'union-eyes',
  'web',
]

describe('x-request-id propagation in proxy', () => {
  for (const app of APPS) {
    it(`${app} — proxy.ts sets x-request-id header`, () => {
      const mwPath = resolve(ROOT, 'apps', app, 'proxy.ts')
      expect(existsSync(mwPath), `${app}/proxy.ts must exist`).toBe(true)

      const content = readFileSync(mwPath, 'utf-8')
      expect(
        content,
        `${app}/proxy.ts must set x-request-id header`,
      ).toContain('x-request-id')
    })
  }
})
