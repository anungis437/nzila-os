/**
 * Tests for the console + control-plane per-app seeders (Phase 2.3).
 *
 * Both seeders follow the same plan-only Phase-2 contract as the prior
 * reference seeders: deterministic, all `db_write` steps skipped, scoped
 * to a well-known staging-only synthetic org.
 */
import { describe, expect, it } from 'vitest'

import {
  createReporter,
  createRng,
  createTime,
  getProfileTargets,
  type SeedApp,
  type SeedAppReport,
  type SeedContext,
  type SeedProfile,
} from '../src/index'

import * as consoleSeeder from '../src/seeders/console'
import * as controlPlaneSeeder from '../src/seeders/control-plane'

interface SeederBundle {
  readonly app: SeedApp
  readonly stagingOrgId: string
  readonly mod: {
    readonly seeder: import('../src/index').SeederModule
    readonly STAGING_ORG: { readonly id: string; readonly name: string }
  }
}

const BUNDLES: readonly SeederBundle[] = [
  { app: 'console', stagingOrgId: 'org-console-staging-ops-9999', mod: consoleSeeder },
  { app: 'control-plane', stagingOrgId: 'org-control-plane-staging-governance-9999', mod: controlPlaneSeeder },
]

function makeCtx(app: SeedApp, profile: SeedProfile): SeedContext {
  const targets = getProfileTargets(profile)
  const now = () => new Date('2026-04-23T00:00:00.000Z')
  const rng = createRng(20260423)
  const time = createTime(targets, now())
  const report = createReporter({ app, profile, dryRun: true, now })
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }
  return {
    app, profile, seed: 20260423, targets, dryRun: true, rng, time, report, logger,
  }
}

for (const bundle of BUNDLES) {
  describe(`${bundle.app} seeder`, () => {
    const { seeder } = bundle.mod

    it('declares the right app and supports the demo-standard profile', () => {
      expect(seeder.app).toBe(bundle.app)
      expect(seeder.supportedProfiles).toContain('demo-standard')
    })

    it(`exposes the well-known staging org "${bundle.stagingOrgId}"`, () => {
      expect(bundle.mod.STAGING_ORG.id).toBe(bundle.stagingOrgId)
      expect(bundle.mod.STAGING_ORG.name).toMatch(/staging/i)
    })

    it('reports a non-empty plan with db_write skipped', async () => {
      const ctx = makeCtx(bundle.app, 'demo-light')
      const report: SeedAppReport = await seeder.seed(ctx)
      expect(report.totalRecords).toBeGreaterThan(0)
      const dbWrite = report.steps.find((s) => s.step === 'db_write')
      expect(dbWrite?.skipped).toBe(true)
    })

    it('scales totalRecords monotonically across profiles', async () => {
      const profiles: SeedProfile[] = [
        'demo-light',
        'demo-standard',
        'executive-showcase',
        'investor-showcase',
      ]
      const totals: number[] = []
      for (const p of profiles) {
        const r = await seeder.seed(makeCtx(bundle.app, p))
        totals.push(r.totalRecords)
      }
      for (let i = 1; i < totals.length; i++) {
        expect(totals[i]).toBeGreaterThan(totals[i - 1]!)
      }
    })

    it('reset returns a single skipped phase-2 step', async () => {
      const ctx = makeCtx(bundle.app, 'demo-light')
      expect(seeder.reset).toBeDefined()
      const report = await seeder.reset!(ctx)
      expect(report.steps).toHaveLength(1)
      expect(report.steps[0]!.step).toBe('reset')
      expect(report.steps[0]!.skipped).toBe(true)
      expect(report.steps[0]!.note).toMatch(/phase 2/i)
    })

    it('is deterministic for the same (profile, seed)', async () => {
      const r1 = await seeder.seed(makeCtx(bundle.app, 'demo-standard'))
      const r2 = await seeder.seed(makeCtx(bundle.app, 'demo-standard'))
      expect(r1.totalRecords).toBe(r2.totalRecords)
      expect(r1.steps.map((s) => `${s.step}:${s.count}`)).toEqual(
        r2.steps.map((s) => `${s.step}:${s.count}`),
      )
    })
  })
}
