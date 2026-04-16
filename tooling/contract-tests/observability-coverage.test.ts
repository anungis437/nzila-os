import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readContent, relPath } from './governance-helpers'
import { getAppRoot, loadAllMaturities, routeFilesForApp, runtimeFilesForApp } from './hardening-helpers'

describe('Observability coverage', () => {
  const maturities = loadAllMaturities()

  it('pilot and production apps declare a telemetry or structured logging surface', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (!new Set(['pilot', 'production']).has(maturity.status)) continue
      const appRoot = getAppRoot(app)
      const instrumentationPath = join(appRoot, 'instrumentation.ts')
      const telemetryPath = join(appRoot, 'lib', 'telemetry.ts')
      const hasInstrumentation = existsSync(instrumentationPath) || existsSync(telemetryPath)
      const hasLoggerUsage = runtimeFilesForApp(app).some((filePath) => {
        const source = readContent(filePath)
        return source.includes('@nzila/observability') || source.includes('createLogger') || source.includes('logger.')
      })

      if (!hasInstrumentation && !hasLoggerUsage) {
        violations.push(app)
      }
    }

    expect(violations).toEqual([])
  })

  it('pilot and production middleware propagates a request identifier when middleware exists', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (!new Set(['pilot', 'production']).has(maturity.status)) continue
      const middlewarePath = join(getAppRoot(app), 'middleware.ts')
      if (!existsSync(middlewarePath)) continue
      const source = readContent(middlewarePath)
      const hasTracePropagation = /x-request-id|request-id|correlationId|trace_id/i.test(source)
      if (!hasTracePropagation) {
        violations.push(relPath(middlewarePath))
      }
    }

    expect(violations).toEqual([])
  })

  it('health endpoints expose status and timestamp when present', () => {
    const violations: string[] = []

    for (const app of Object.keys(maturities)) {
      const healthPath = join(getAppRoot(app), 'app', 'api', 'health', 'route.ts')
      if (!existsSync(healthPath)) continue
      const source = readContent(healthPath)
      if (!/status/.test(source) || !/timestamp|generated_at|generatedAt/.test(source)) {
        violations.push(relPath(healthPath))
      }
    }

    expect(violations).toEqual([])
  })

  it('API routes avoid bare console.log', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (!new Set(['pilot', 'production']).has(maturity.status)) continue
      for (const filePath of routeFilesForApp(app)) {
        const source = readContent(filePath)
        if (/console\.log\(/.test(source)) {
          violations.push(relPath(filePath))
        }
      }
    }

    expect(violations).toEqual([])
  })
})
