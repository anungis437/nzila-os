import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { relPath } from './governance-helpers'
import { listApps, loadAllMaturities, routeFilesForApp, runtimeFilesForApp } from './hardening-helpers'

const ALLOWED_STATUS = new Set(['production', 'pilot', 'internal', 'scaffold', 'deprecated'])
const ALLOWED_EXPOSURE = new Set(['public', 'internal'])
const ALLOWED_DATA_INTEGRITY = new Set(['enforced', 'partial', 'minimal'])
const ALLOWED_OBSERVABILITY = new Set(['complete', 'partial', 'minimal'])

describe('App maturity enforcement', () => {
  const apps = listApps()
  const maturities = loadAllMaturities()

  it('uses only canonical maturity values', () => {
    const violations: string[] = []

    for (const app of apps) {
      const maturity = maturities[app]
      if (!ALLOWED_STATUS.has(maturity.status)) violations.push(`${app}: invalid status ${maturity.status}`)
      if (!ALLOWED_EXPOSURE.has(maturity.exposure)) violations.push(`${app}: invalid exposure ${maturity.exposure}`)
      if (!ALLOWED_DATA_INTEGRITY.has(maturity.data_integrity)) violations.push(`${app}: invalid data_integrity ${maturity.data_integrity}`)
      if (!ALLOWED_OBSERVABILITY.has(maturity.observability)) violations.push(`${app}: invalid observability ${maturity.observability}`)
      if (!/^2026-04-16$/.test(maturity.last_validated)) violations.push(`${app}: unexpected last_validated ${maturity.last_validated}`)
    }

    expect(violations).toEqual([])
  })

  it('production apps remain free of TODO or demo leakage in runtime code', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (maturity.status !== 'production') continue
      for (const filePath of runtimeFilesForApp(app)) {
        const source = readFileSync(filePath, 'utf8')
        if (/TODO/i.test(source) || /demoData|mockData|fallbackData/i.test(source)) {
          violations.push(relPath(filePath))
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('pilot apps only expose demo data in explicit pilot or demo-gated paths', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (maturity.status !== 'pilot') continue

      for (const filePath of runtimeFilesForApp(app)) {
        const source = readFileSync(filePath, 'utf8')
        const usesDemoData = /generateDemo|getDemoDataset|demoData|demo dataset/i.test(source)
        if (!usesDemoData) continue

        const isExplicitPilotSurface = /[\\/]pilot[\\/]/.test(filePath) || source.includes('NZILA_MODE') || source.includes('DEMO MODE')
        if (!isExplicitPilotSurface) {
          violations.push(relPath(filePath))
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('scaffold apps do not expose API routes beyond health checks', () => {
    const violations: string[] = []

    for (const [app, maturity] of Object.entries(maturities)) {
      if (maturity.status !== 'scaffold') continue
      const disallowedRoutes = routeFilesForApp(app)
        .map((filePath) => relPath(filePath))
        .filter((filePath) => !filePath.endsWith('/app/api/health/route.ts'))
      violations.push(...disallowedRoutes)
    }

    expect(violations).toEqual([])
  })
})
