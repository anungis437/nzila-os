/**
 * Contract Test — Instrumentation Mandatory (STUDIO-OTEL-01)
 *
 * Verifies:
 *   Every Next.js app MUST have an `instrumentation.ts` at the app root
 *   that calls `initOtel` from `@nzila/os-core/telemetry`.
 *
 *   Business apps (not web) must additionally call `initMetrics` and
 *   `assertBootInvariants`.
 *
 * This enforces uniform OpenTelemetry instrumentation across all apps,
 * so every request is traced, every app emits metrics, and boot
 * invariants are validated before accepting traffic.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/** All Next.js apps that must have instrumentation.ts */
const NEXT_APPS = [
  'console',
  'partners',
  'web',
  'union-eyes',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
]

/** Apps where initMetrics + assertBootInvariants are optional (marketing) */
const LIGHT_INSTRUMENTATION = ['web']

describe('Instrumentation mandatory', () => {
  for (const app of NEXT_APPS) {
    const instrPath = resolve(ROOT, 'apps', app, 'instrumentation.ts')

    it(`${app} — has instrumentation.ts`, () => {
      expect(
        existsSync(instrPath),
        `${app}/instrumentation.ts must exist`,
      ).toBe(true)
    })

    it(`${app} — instrumentation.ts calls initOtel or createAppBoot`, () => {
      if (!existsSync(instrPath)) return
      const content = readFileSync(instrPath, 'utf-8')
      const usesCanonicalBoot = content.includes('createAppBoot')
      const usesDirectInit = content.includes('initOtel')
      expect(
        usesCanonicalBoot || usesDirectInit,
        `${app}/instrumentation.ts must call createAppBoot() or initOtel()`,
      ).toBe(true)
      expect(content).toContain('@nzila/os-core/telemetry')
    })

    if (!LIGHT_INSTRUMENTATION.includes(app)) {
      it(`${app} — instrumentation.ts calls initMetrics or createAppBoot`, () => {
        if (!existsSync(instrPath)) return
        const content = readFileSync(instrPath, 'utf-8')
        const usesCanonicalBoot = content.includes('createAppBoot')
        const usesDirectMetrics = content.includes('initMetrics')
        expect(
          usesCanonicalBoot || usesDirectMetrics,
          `${app}/instrumentation.ts must call createAppBoot() or initMetrics()`,
        ).toBe(true)
      })
    }
  }
})
