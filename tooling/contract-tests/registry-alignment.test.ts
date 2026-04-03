/**
 * Contract test: App Registry ↔ filesystem alignment
 *
 * Validates:
 *   REG-001: Every apps/ directory has an entry in APP_REGISTRY
 *   REG-002: Every APP_REGISTRY entry has a matching apps/ directory
 *   REG-003: Registry self-validates (no schema violations)
 *   REG-004: Production apps have health endpoints configured
 *   REG-005: Apps with financial records have hash-chain governance
 *   REG-006: Staging-deployed apps have container images
 *   REG-007: All governance controlIds are globally unique
 *   REG-008: Registry app ids match their directory names
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  APP_REGISTRY,
  validateBuiltInRegistry,
  getProductionApps,
} from '@nzila/platform-contracts/registry'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

const appDirs = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()

const registryIds = APP_REGISTRY.map(a => a.id).sort()

describe('App Registry ↔ Filesystem alignment', () => {
  it('REG-001: every apps/ directory has an entry in APP_REGISTRY', () => {
    const missing = appDirs.filter(dir => !registryIds.includes(dir))
    expect(
      missing,
      `Apps missing from registry: ${missing.join(', ')}. Add entries to packages/platform-contracts/src/registry.ts`,
    ).toEqual([])
  })

  it('REG-002: every APP_REGISTRY entry has a matching apps/ directory', () => {
    const orphaned = registryIds.filter(id => !appDirs.includes(id))
    expect(
      orphaned,
      `Registry entries without app directories: ${orphaned.join(', ')}`,
    ).toEqual([])
  })

  it('REG-003: registry self-validates', () => {
    const result = validateBuiltInRegistry()
    expect(result.errors, `Registry validation errors:\n${result.errors.join('\n')}`).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('REG-004: production apps have health endpoints', () => {
    const prod = getProductionApps()
    const missing = prod
      .filter(a => a.appType !== 'static-site')
      .filter(a => !a.healthBinding?.healthPath)
    expect(
      missing.map(a => a.id),
      'Production apps must declare a healthBinding.healthPath',
    ).toEqual([])
  })

  it('REG-005: apps with financial records have hash-chain governance', () => {
    const financial = APP_REGISTRY.filter(a => a.reportingBindings?.emitsFinancialRecords)
    for (const app of financial) {
      const hasHashChain = app.governanceRequirements.some(
        g => g.evidenceClass === 'hash-chain',
      )
      expect(
        hasHashChain,
        `${app.id} emits financial records but has no hash-chain governance control`,
      ).toBe(true)
    }
  })

  it('REG-006: staging-deployed apps have container images', () => {
    const staging = APP_REGISTRY.filter(a =>
      a.deployment?.environments?.includes('staging'),
    )
    for (const app of staging) {
      expect(
        app.deployment?.containerImage,
        `${app.id} deploys to staging but has no containerImage`,
      ).toBeTruthy()
    }
  })

  it('REG-007: all governance controlIds are globally unique', () => {
    const allControlIds = APP_REGISTRY.flatMap(a =>
      a.governanceRequirements.map(g => g.controlId),
    )
    const dupes = allControlIds.filter(
      (id, i) => allControlIds.indexOf(id) !== i,
    )
    expect(dupes, `Duplicate governance controlIds: ${dupes.join(', ')}`).toEqual([])
  })

  it('REG-008: registry app ids match directory names', () => {
    for (const app of APP_REGISTRY) {
      const dirExists = existsSync(join(APPS_DIR, app.id))
      expect(dirExists, `Registry id "${app.id}" has no matching directory at apps/${app.id}`).toBe(true)
    }
  })
})
