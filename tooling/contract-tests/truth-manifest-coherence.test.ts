import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, relPath } from './governance-helpers'
import { getMaturityPath, listApps, loadAllMaturities, readJsonFile, type MaturityStatus } from './hardening-helpers'

interface TruthManifest {
  platform_status: string
  last_audit: string
  apps: Record<string, MaturityStatus>
  blocking_gaps: string[]
}

describe('Truth Manifest coherence', () => {
  const truthManifestPath = join(ROOT, 'nzila-truth-manifest.json')
  const truthManifest = readJsonFile<TruthManifest>(truthManifestPath)
  const appNames = listApps().sort()
  const maturities = loadAllMaturities()

  it('exists at the repo root', () => {
    expect(existsSync(truthManifestPath), `${relPath(truthManifestPath)} must exist`).toBe(true)
  })

  it('every app has a maturity declaration', () => {
    const missing = appNames.filter((app) => !existsSync(getMaturityPath(app)))
    expect(missing).toEqual([])
  })

  it('covers every app exactly once', () => {
    expect(Object.keys(truthManifest.apps).sort()).toEqual(appNames)
  })

  it('matches each app maturity status', () => {
    const mismatches = appNames
      .filter((app) => truthManifest.apps[app] !== maturities[app]?.status)
      .map((app) => `${app}: manifest=${truthManifest.apps[app]} maturity=${maturities[app]?.status ?? 'missing'}`)

    expect(mismatches).toEqual([])
  })

  it('stays fail-closed about overall platform status', () => {
    const productionApps = Object.entries(truthManifest.apps).filter(([, status]) => status === 'production')
    if (productionApps.length === 0) {
      expect(truthManifest.platform_status).not.toBe('production-ready')
      expect(truthManifest.blocking_gaps.length).toBeGreaterThan(0)
    }
  })
})
