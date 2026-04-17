import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, relPath } from './governance-helpers'
import { getMaturityPath, listApps, loadAllMaturities, readJsonFile, type MaturityStatus } from './hardening-helpers'
import { APP_REGISTRY } from '../../packages/platform-contracts/src/registry'

interface TruthManifest {
  status_model_version: string
  platform_status: string
  last_audit: string
  apps: Record<string, MaturityStatus>
  app_status: Record<string, {
    registry_tier: string
    deployment_status: MaturityStatus
    readiness_tier: string
    exposure: 'public' | 'internal'
  }>
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

  it('includes dual-axis app_status entries for every app', () => {
    expect(Object.keys(truthManifest.app_status).sort()).toEqual(appNames)
  })

  it('matches each app maturity status', () => {
    const mismatches = appNames
      .filter((app) => truthManifest.apps[app] !== maturities[app]?.status)
      .map((app) => `${app}: manifest=${truthManifest.apps[app]} maturity=${maturities[app]?.status ?? 'missing'}`)

    expect(mismatches).toEqual([])
  })

  it('keeps app_status.deployment_status aligned with apps map', () => {
    const mismatches = appNames
      .filter((app) => truthManifest.app_status[app]?.deployment_status !== truthManifest.apps[app])
      .map(
        (app) => `${app}: apps=${truthManifest.apps[app]} app_status.deployment_status=${truthManifest.app_status[app]?.deployment_status ?? 'missing'}`,
      )

    expect(mismatches).toEqual([])
  })

  it('matches canonical registry tier for each app', () => {
    const registryTiers = new Map(APP_REGISTRY.map((app) => [app.id, app.tier]))

    const mismatches = appNames
      .filter((app) => truthManifest.app_status[app]?.registry_tier !== registryTiers.get(app))
      .map(
        (app) => `${app}: manifest=${truthManifest.app_status[app]?.registry_tier ?? 'missing'} registry=${registryTiers.get(app) ?? 'missing'}`,
      )

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
